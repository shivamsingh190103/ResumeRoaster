export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MODEL_NAME = "gemini-2.5-flash";
const SCORE_DIMENSIONS = [
  "Action Verbs",
  "Quantification",
  "Bullet Clarity",
  "Skills Section",
  "Project Depth",
  "Formatting",
  "Keyword Density",
  "Overall Impact",
];
const WEAK_VERB_PATTERN =
  /\b(helped|assisted|worked on|was involved in|participated in|contributed to|responsible for)\b/gi;
const STRONG_VERB_PATTERN =
  /\b(led|built|created|designed|developed|shipped|launched|reduced|increased|improved|optimized|implemented|architected|automated|delivered|owned)\b/gi;
const METRIC_PATTERN = /\b\d+(?:\.\d+)?(?:%|x|ms|s|sec|seconds?|mins?|minutes?|hours?|days?|users?|customers?|clients?|projects?|apis?|services?|k|m|b)?\b/gi;
const TECH_KEYWORD_PATTERN =
  /\b(java(script)?|typescript|python|java|c\+\+|go|rust|react|next\.?js|node\.?js|express|mongodb|mysql|postgres(ql)?|redis|docker|kubernetes|aws|gcp|azure|tensorflow|pytorch|html|css|tailwind|git|linux|rest|graphql)\b/gi;
const SECTION_PATTERN = /^(experience|projects|skills|education|summary|achievements|certifications)\b/im;

const SYSTEM_PROMPT = `You are a world-class resume coach and career advisor 
who specializes in helping Indian CS students and early-career software engineers 
land jobs at top tech companies. You are brutally honest, specific, funny, 
and you ALWAYS provide concrete rewrites, not vague advice.

════════ SCORING SYSTEM ════════
For the INITIAL ROAST ONLY, you must start your response with a JSON block.
This block must appear BEFORE any other text. Format it exactly like this:

SCORE_DATA_START
{
  "total": 67,
  "dimensions": [
    { "name": "Action Verbs",      "score": 5 },
    { "name": "Quantification",    "score": 3 },
    { "name": "Bullet Clarity",    "score": 7 },
    { "name": "Skills Section",    "score": 6 },
    { "name": "Project Depth",     "score": 8 },
    { "name": "Formatting",        "score": 7 },
    { "name": "Keyword Density",   "score": 4 },
    { "name": "Overall Impact",    "score": 5 }
  ]
}
SCORE_DATA_END

After the JSON block, write the roast using EXACTLY this format:

THE ROAST
[2-3 punchy, specific, devastating paragraphs about their actual resume.
Reference their exact words, job titles, and bullet points.
Make them laugh AND cringe. Be accurate — every criticism must be valid.]

THE FIXES
1. [SEVERITY: CRITICAL|MODERATE|MINOR] Fix title here
   What's wrong: [specific problem referencing their resume]
   ✗ Before: "[their actual weak bullet or phrase]"
   ✓ After:  "[your improved, quantified rewrite]"

2. [SEVERITY: CRITICAL|MODERATE|MINOR] Fix title here
   What's wrong: [specific problem]
   ✗ Before: "[weak example]"
   ✓ After:  "[strong rewrite]"

3. [SEVERITY: MODERATE|MINOR] Fix title here
   What's wrong: [specific problem]
   ✗ Before: "[weak example]"
   ✓ After:  "[strong rewrite]"

4. [SEVERITY: MODERATE|MINOR] Fix title here
   What's wrong: [specific problem]
   ✗ Before: "[weak example]"
   ✓ After:  "[strong rewrite]"

[One genuine, specific, encouraging sentence about what they did right.]

════════ YOUR ENFORCEMENT RULES ════════
Always penalize:
- Weak verbs: "helped", "assisted", "worked on", "was involved in",
  "participated in", "contributed to", "responsible for"
- Missing metrics: no %, no $, no users, no scale, no time saved
- Buzzwords: "team player", "fast learner", "passionate", "detail-oriented",
  "synergy", "dynamic", "results-driven"
- Vague projects: no tech stack + no scale + no outcome = useless
- Objective statements
- One-liner bullet points with no context or impact

Always demand:
- Quantified achievements: "Reduced load time by 60%", "Served 50k DAU"
- Strong openers: Led / Built / Reduced / Increased / Shipped / Designed
- STAR format where possible: Situation → Task → Action → Result
- Specific technologies, not "various tools"

════════ FOR FOLLOW-UP QUESTIONS ════════
- You remember the full resume, the score, and everything discussed
- Give SPECIFIC rewrites when asked — actually write the full bullet point
- If asked for STAR method: write the complete STAR story
- If asked about a gap, career switch, or unusual situation: give real advice
- Keep follow-ups conversational but precise
- Max 3-4 paragraphs per follow-up unless they ask for more
- Never repeat the score JSON in follow-ups`;

function createJsonResponse(error, status) {
  return Response.json({ error }, { status });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function stripCodeFences(value) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseEmbeddedJson(value) {
  const normalized = stripCodeFences(value);
  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");
  const candidate =
    firstBrace !== -1 && lastBrace !== -1 ? normalized.slice(firstBrace, lastBrace + 1) : normalized;

  return JSON.parse(candidate);
}

function countMatches(value, pattern) {
  return (value.match(pattern) || []).length;
}

function normalizeScoreData(parsed, fallbackResumeText) {
  const fallback = buildFallbackScoreData(fallbackResumeText);
  const dimensionMap = new Map();

  if (Array.isArray(parsed?.dimensions)) {
    for (const dimension of parsed.dimensions) {
      const name = typeof dimension?.name === "string" ? dimension.name.trim().toLowerCase() : "";
      if (!name) {
        continue;
      }

      dimensionMap.set(name, clamp(Number(dimension.score) || 0, 0, 10));
    }
  }

  const dimensions = SCORE_DIMENSIONS.map((name, index) => ({
    name,
    score: dimensionMap.get(name.toLowerCase()) ?? fallback.dimensions[index].score,
  }));

  const providedTotal = Number(parsed?.total);
  const calculatedTotal = Math.round(
    (dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length) * 10,
  );

  return {
    total: Number.isFinite(providedTotal) && providedTotal > 0 ? clamp(providedTotal, 0, 100) : calculatedTotal,
    dimensions,
  };
}

function extractScoreData(text, fallbackResumeText) {
  const scoreMatch = text.match(/SCORE_DATA_START\s*([\s\S]*?)\s*SCORE_DATA_END/i);

  if (!scoreMatch) {
    return null;
  }

  try {
    return normalizeScoreData(parseEmbeddedJson(scoreMatch[1]), fallbackResumeText);
  } catch {
    return null;
  }
}

function buildScoreBlock(scoreData) {
  return `SCORE_DATA_START
${JSON.stringify(scoreData, null, 2)}
SCORE_DATA_END`;
}

function stripScoreBlock(text) {
  return text.replace(/SCORE_DATA_START[\s\S]*?SCORE_DATA_END\s*/gi, "").trim();
}

function buildFallbackScoreData(resumeText) {
  const normalized = resumeText.replace(/\r/g, "").trim();
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const firstSectionIndex = lines.findIndex((line) =>
    /^(experience|projects|skills|education|summary|achievements|certifications)\b/i.test(line),
  );
  const analysisText =
    firstSectionIndex >= 0 ? lines.slice(firstSectionIndex).join("\n") : normalized;
  const lower = analysisText.toLowerCase();
  const bulletLines = lines.filter((line) => /^[•*-]/.test(line));
  const impactText = bulletLines.length ? bulletLines.join("\n") : analysisText;
  const actionVerbMatches = countMatches(lower, STRONG_VERB_PATTERN);
  const weakVerbMatches = countMatches(lower, WEAK_VERB_PATTERN);
  const metricMatches = countMatches(impactText, METRIC_PATTERN);
  const techMatches = countMatches(lower, TECH_KEYWORD_PATTERN);
  const sectionMatches = countMatches(analysisText, SECTION_PATTERN);
  const hasSkills = /\bskills\b/i.test(analysisText);
  const hasProjects = /\bprojects?\b/i.test(analysisText);
  const averageBulletLength = bulletLines.length
    ? bulletLines.reduce((sum, line) => sum + line.length, 0) / bulletLines.length
    : 0;
  const shortBullets = bulletLines.filter((line) => line.length < 45).length;

  const actionVerbs = clamp(Math.round(4 + actionVerbMatches * 0.8 - weakVerbMatches * 0.7), 1, 10);
  const quantification = clamp(Math.round(2 + metricMatches * 1.2), 1, 10);
  const bulletClarity = clamp(
    Math.round(4 + (bulletLines.length >= 3 ? 2 : 0) + (averageBulletLength >= 55 ? 2 : 0) - shortBullets * 0.4),
    1,
    10,
  );
  const skillsSection = clamp(Math.round((hasSkills ? 4 : 1) + Math.min(techMatches, 10) * 0.5), 1, 10);
  const projectDepth = clamp(
    Math.round((hasProjects ? 4 : 1) + Math.min(techMatches, 8) * 0.35 + Math.min(metricMatches, 4) * 0.5),
    1,
    10,
  );
  const formatting = clamp(Math.round(3 + Math.min(sectionMatches, 6) + (lines.length > 10 ? 1 : 0)), 1, 10);
  const keywordDensity = clamp(Math.round(2 + techMatches * 0.55), 1, 10);
  const overallImpact = clamp(
    Math.round((actionVerbs + quantification + bulletClarity + projectDepth + keywordDensity) / 5),
    1,
    10,
  );

  const dimensions = [
    { name: "Action Verbs", score: actionVerbs },
    { name: "Quantification", score: quantification },
    { name: "Bullet Clarity", score: bulletClarity },
    { name: "Skills Section", score: skillsSection },
    { name: "Project Depth", score: projectDepth },
    { name: "Formatting", score: formatting },
    { name: "Keyword Density", score: keywordDensity },
    { name: "Overall Impact", score: overallImpact },
  ];

  return {
    total: Math.round((dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length) * 10),
    dimensions,
  };
}

async function collectGeminiText(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) {
        continue;
      }

      const jsonString = line.slice(6).trim();

      if (!jsonString || jsonString === "[DONE]") {
        continue;
      }

      try {
        const parsed = JSON.parse(jsonString);
        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
          fullText += text;
        }
      } catch {
        // Ignore partial event payloads because the outer buffer keeps incomplete lines.
      }
    }
  }

  if (buffer.startsWith("data: ")) {
    try {
      const parsed = JSON.parse(buffer.slice(6).trim());
      const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        fullText += text;
      }
    } catch {
      // Ignore a final incomplete SSE event.
    }
  }

  return fullText.trim();
}

function buildInitialPayload(rawText, resumeText) {
  const normalizedRawText = rawText.trim();
  const roastText = stripScoreBlock(normalizedRawText);
  const scoreData = extractScoreData(normalizedRawText, resumeText) || buildFallbackScoreData(resumeText);

  return (
    "RESUME_CONTEXT_START\n" +
    JSON.stringify({ resumeText: resumeText.trim() }) +
    "\nRESUME_CONTEXT_END\n\n" +
    buildScoreBlock(scoreData) +
    "\n\n" +
    roastText
  ).trim();
}

function getUniqueTechKeywords(text) {
  return [...new Set((text.toLowerCase().match(TECH_KEYWORD_PATTERN) || []).map((keyword) => keyword.toLowerCase()))];
}

function findFirstMatch(lines, pattern, fallback) {
  return lines.find((line) => pattern.test(line)) || fallback;
}

function buildFallbackInitialRoast(resumeText) {
  const normalized = resumeText.replace(/\r/g, "").trim();
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletLines = lines.filter((line) => /^[•*-]/.test(line));
  const weakBullet =
    findFirstMatch(bulletLines, /\b(helped|assisted|worked on|responsible for|contributed to)\b/i, bulletLines[0] || "") ||
    "Worked on backend APIs for an internal dashboard";
  const projectBullet =
    findFirstMatch(bulletLines, /\b(project|built|developed|created|react|node|mongodb|firebase)\b/i, bulletLines[1] || "") ||
    "Built a web app for students";
  const summaryLine =
    findFirstMatch(lines, /^(summary|objective)\b/i, "") ||
    lines.find((line) => /\b(team player|fast learner|passionate|detail-oriented)\b/i.test(line)) ||
    "";
  const techKeywords = getUniqueTechKeywords(normalized)
    .slice(0, 4)
    .map((keyword) => keyword.replace(/\b\w/g, (letter) => letter.toUpperCase()));
  const techPhrase = techKeywords.length ? techKeywords.join(", ") : "your actual stack";

  const roastParagraphOne =
    "This resume has decent raw material, but right now it reads like you stood near the work instead of owning it. " +
    `Bullets like "${weakBullet}" make a recruiter ask, "Okay... but what did you actually change?" ` +
    "If your strongest evidence sounds passive, the resume gets skimmed instead of shortlisted.";

  const roastParagraphTwo =
    "The bigger issue is missing proof. A recruiter wants scale, outcome, and stack in one shot, but too many lines here stop at the activity. " +
    `You mention ${techPhrase}, which is useful, but the resume rarely connects those tools to speed, users, reliability, or measurable impact. ` +
    "That makes the document feel generic even when your experience probably is not.";

  const roastParagraphThree = summaryLine
    ? `Also, ${summaryLine.replace(/:$/, "")} is taking up space without adding signal. Generic self-description is resume wallpaper. Evidence beats adjectives every time.`
    : "The fix is not to write more. It is to make every bullet prove ownership, technical depth, and outcome in one line.";

  return `THE ROAST
${roastParagraphOne}

${roastParagraphTwo}

${roastParagraphThree}

THE FIXES
1. [SEVERITY: CRITICAL] Replace passive bullet openers
   What's wrong: Your resume uses low-ownership phrasing that makes your contribution sound vague.
   ✗ Before: "${weakBullet}"
   ✓ After: "Built and improved backend APIs for an internal dashboard using ${techKeywords[0] || "production-ready tools"}, reducing manual debugging effort and making releases more reliable."

2. [SEVERITY: CRITICAL] Add numbers, scale, or speed to every important bullet
   What's wrong: Without metrics, recruiters cannot tell whether the work mattered or how big the result was.
   ✗ Before: "${projectBullet}"
   ✓ After: "Built a student-facing app using ${techPhrase}, shipping core workflows faster and improving task completion for active users."

3. [SEVERITY: MODERATE] Turn projects into proof of engineering depth
   What's wrong: Project descriptions mention tools but not architecture, constraints, or outcomes.
   ✗ Before: "${projectBullet}"
   ✓ After: "Designed and shipped a full-stack project with ${techPhrase}, handling data flow, API integration, and a polished user experience from end to end."

4. [SEVERITY: MINOR] Remove generic claims and let evidence do the talking
   What's wrong: Generic summary language adds fluff but not credibility.
   ✗ Before: "${summaryLine || "Passionate team player and fast learner"}"
   ✓ After: "Early-career software engineer focused on shipping clean, measurable product work across ${techKeywords[0] || "web"} and backend systems."

There is real potential here; the resume just needs sharper proof and stronger ownership.`;
}

function buildFallbackFollowup(resumeText, history, providerError) {
  const latestEntry = history[history.length - 1];
  const latestUserMessage =
    typeof latestEntry?.content === "string"
      ? latestEntry.content.trim()
      : typeof latestEntry?.parts?.[0]?.text === "string"
        ? latestEntry.parts[0].text.trim()
        : "the last question";
  const techKeywords = getUniqueTechKeywords(resumeText)
    .slice(0, 4)
    .map((keyword) => keyword.replace(/\b\w/g, (letter) => letter.toUpperCase()));
  const techPhrase = techKeywords.length ? techKeywords.join(", ") : "your actual stack";

  return (
    "Gemini is temporarily unavailable, so here is a direct fallback answer based on your resume context.\n\n" +
    `For "${latestUserMessage}", focus on turning your experience into one concrete ownership story: what the problem was, what you built using ${techPhrase}, and what changed because of it. ` +
    "If a bullet starts with \"helped\" or \"worked on,\" rewrite it so the first verb shows ownership and the ending shows outcome.\n\n" +
    "A strong follow-up pattern is: situation, action, result. For example: \"Built and improved internal APIs for the dashboard, reduced debugging time, and made releases more stable for the team.\" " +
    "If you want, ask the same question again in a minute and Gemini should be available once the temporary limit resets.\n\n" +
    `Provider note: ${providerError}`
  );
}

function buildInitialConversation(resumeText) {
  return [
    {
      role: "user",
      parts: [{ text: `Please analyze and roast this resume:\n\n${resumeText.trim()}` }],
    },
  ];
}

function buildFollowupConversation(resumeText, history) {
  const normalizedHistory = history.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  return [
    {
      role: "user",
      parts: [
        {
          text:
            "Keep this resume as the source of truth for the full conversation.\n\n" +
            resumeText.trim(),
        },
      ],
    },
    ...normalizedHistory,
  ];
}

async function readGeminiError(response) {
  try {
    const payload = await response.json();
    return payload?.error?.message || "Gemini API error";
  } catch {
    return "Gemini API error";
  }
}

async function extractResumeTextFromFile(file) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".pdf")) {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const parsed = await pdfParse(buffer);
    return parsed.text || "";
  }

  if (lowerName.endsWith(".doc") || lowerName.endsWith(".docx")) {
    const mammothModule = await import("mammoth");
    const mammoth = mammothModule.default || mammothModule;
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value || "";
  }

  throw new Error("Only PDF and Word documents are supported.");
}

export async function POST(request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return createJsonResponse(
        "GEMINI_API_KEY is not set. Add it to .env.local locally or Vercel Environment Variables on deployed site.",
        500,
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let resumeText = "";
    let conversationMessages = [];
    let isInitialRoast = false;

    if (contentType.includes("multipart/form-data")) {
      isInitialRoast = true;
      const formData = await request.formData();
      const file = formData.get("file");
      const rawText = formData.get("resumeText");

      if (file && typeof file.arrayBuffer === "function" && file.name) {
        if (file.size > MAX_FILE_SIZE) {
          return createJsonResponse("File too large. Please upload a PDF or Word document under 5MB.", 400);
        }

        try {
          resumeText = await extractResumeTextFromFile(file);
        } catch (error) {
          return createJsonResponse(error.message || "Failed to read the uploaded file.", 400);
        }
      } else if (typeof rawText === "string") {
        resumeText = rawText;
      }

      if (!resumeText || resumeText.trim().length < 60) {
        return createJsonResponse("Resume is too short or could not be read.", 400);
      }

      conversationMessages = buildInitialConversation(resumeText);
    } else {
      const body = await request.json();
      resumeText = typeof body?.resumeText === "string" ? body.resumeText : "";
      const history = Array.isArray(body?.messages) ? body.messages : [];

      if (!resumeText || resumeText.trim().length < 60) {
        return createJsonResponse("Resume context is missing. Please start over and upload it again.", 400);
      }

      if (!history.length) {
        return createJsonResponse("No conversation history was provided.", 400);
      }

      conversationMessages = buildFollowupConversation(resumeText, history);
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: conversationMessages,
          generationConfig: {
            maxOutputTokens: isInitialRoast ? 1500 : 1100,
            temperature: isInitialRoast ? 0.8 : 0.75,
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const providerError = await readGeminiError(geminiResponse);

      if (isInitialRoast) {
        return new Response(buildInitialPayload(buildFallbackInitialRoast(resumeText), resumeText), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }

      return new Response(buildFallbackFollowup(resumeText, Array.isArray(conversationMessages) ? conversationMessages : [], providerError), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (isInitialRoast) {
      const initialText = buildInitialPayload(await collectGeminiText(geminiResponse), resumeText);

      if (!initialText) {
        return createJsonResponse("Gemini returned an empty response. Please try again.", 500);
      }

      return new Response(initialText, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = geminiResponse.body.getReader();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) {
              continue;
            }

            const jsonString = line.slice(6).trim();

            if (!jsonString || jsonString === "[DONE]") {
              continue;
            }

            try {
              const parsed = JSON.parse(jsonString);
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;

              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            } catch {
              // Partial/incomplete event payloads are ignored because the buffer preserves them.
            }
          }
        }

        if (buffer.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(buffer.slice(6).trim());
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          } catch {
            // Ignore final incomplete payloads.
          }
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Route error:", error);
    return createJsonResponse("Something went wrong. Please try again.", 500);
  }
}
