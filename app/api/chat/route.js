export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MODEL_NAME = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are a sharp, witty career coach who 
roasts resumes with brutal honesty — but genuinely wants people 
to succeed. Be specific to what they wrote. Call out vague verbs, 
hollow buzzwords, weak quantification, missing metrics, 
formatting red flags, and anything a recruiter would skip.
Be funny, direct, and devastatingly accurate.

IMPORTANT: Format your response EXACTLY like this with these 
exact headings — do not change the heading names:

THE ROAST
[Write 2-3 punchy, specific paragraphs roasting their actual resume. 
Reference specific things they wrote. Make it sting but be accurate.]

THE FIXES
1. [Specific actionable fix — reference their actual content]
2. [Specific actionable fix]
3. [Specific actionable fix]
4. [Specific actionable fix]

Keep each numbered fix to a single line.

[End with exactly one short encouraging sentence on its own line]`;

function getGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let resumeText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file || typeof file.arrayBuffer !== "function") {
        return Response.json({ error: "No file uploaded" }, { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE) {
        return Response.json(
          { error: "File too large. Please upload a PDF or DOCX under 5MB." },
          { status: 400 },
        );
      }

      const fileName = file.name.toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());

      if (fileName.endsWith(".pdf")) {
        const pdfParseModule = await import("pdf-parse");
        const pdfParse = pdfParseModule.default || pdfParseModule;
        const parsed = await pdfParse(buffer);
        resumeText = parsed.text || "";
      } else if (fileName.endsWith(".docx")) {
        const mammothModule = await import("mammoth");
        const mammoth = mammothModule.default || mammothModule;
        const parsed = await mammoth.extractRawText({ buffer });
        resumeText = parsed.value || "";
      } else {
        return Response.json(
          { error: "Only PDF and DOCX files are supported" },
          { status: 400 },
        );
      }
    } else {
      const body = await request.json();
      resumeText = typeof body?.resume === "string" ? body.resume : "";
    }

    if (resumeText.trim().length < 60) {
      return Response.json(
        { error: "Resume content is too short or empty" },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        { error: "Missing GEMINI_API_KEY on the server" },
        { status: 500 },
      );
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: `Roast this resume:\n\n${resumeText.trim()}` }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1024,
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok || data?.error) {
      return Response.json(
        { error: data?.error?.message || "Something went wrong. Please try again." },
        { status: 500 },
      );
    }

    const result = getGeminiText(data);

    if (!result) {
      return Response.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
    }

    return Response.json({ result });
  } catch (error) {
    console.error("Route error:", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
