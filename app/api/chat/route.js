export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MODEL_NAME = "gemini-2.5-flash";

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
      return createJsonResponse(await readGeminiError(geminiResponse), 500);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = geminiResponse.body.getReader();
        let buffer = "";

        if (isInitialRoast) {
          const resumeContextBlock =
            "RESUME_CONTEXT_START\n" +
            JSON.stringify({ resumeText: resumeText.trim() }) +
            "\nRESUME_CONTEXT_END\n\n";
          controller.enqueue(encoder.encode(resumeContextBlock));
        }

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
