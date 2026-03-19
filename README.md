# Resume Roaster

## What It Is

Resume Roaster is a production-grade AI resume coach for CS students and early-career software engineers. Users upload a PDF or Word resume, or paste the full text, then move through a three-step flow:

1. Upload the resume
2. Reveal a dramatic resume health score across 8 dimensions
3. Continue the conversation in a streaming chat to fix each issue in depth

## Why This Topic

Most resume tools are too gentle to be useful. Resume Roaster is designed around the reality that recruiters skim fast, reject vague bullets immediately, and reward specificity. The product leans into that with honest scoring, sharp feedback, before/after rewrites, and follow-up conversation instead of a one-shot report.

## Frontend Decisions

- A three-phase flow keeps the experience focused: upload first, then the score reveal, then the deeper chat.
- The score reveal creates a real “hero moment” before the user drops into the conversation.
- Severity badges plus before/after rewrites help users prioritize and act fast.
- Suggested follow-up chips remove blank-page friction after the first roast.
- Streaming responses make the assistant feel alive instead of static.
- Start over resets the whole experience cleanly so users can test a revised resume without stale state leaking through.

## Features

- PDF upload with server-side parsing via `pdf-parse`
- DOC and DOCX upload with server-side parsing via `mammoth`
- Paste-text mode with live character counting
- Loading state with rotating status messages and shimmer bar
- Animated resume score ring and 8-dimension breakdown
- Structured first roast with severity badges and before/after rewrite blocks
- Streaming follow-up chat with persistent resume context
- Copy feedback and share-summary actions

## Tech Stack

- Next.js 15 App Router
- React 19
- JavaScript only
- CSS Modules only
- Gemini Flash via plain `fetch`
- `pdf-parse` and `mammoth` on the server

## Setup

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Create `.env.local` in the project root:

```bash
GEMINI_API_KEY=your_key_here
```

4. Start the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

## Gemini Key

Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com). The key is used only in `app/api/chat/route.js` and is never exposed to the browser.

## Deploy To Vercel

1. Push the repo to GitHub.
2. Import the project into Vercel.
3. Add `GEMINI_API_KEY` in the Vercel environment settings.
4. Deploy.

## How It Works

1. The client sends either an uploaded file or pasted resume text to the API route.
2. The server parses the file into plain text when needed.
3. Gemini streams the initial roast back, including hidden score metadata for the score reveal phase.
4. The client extracts the score block, shows the animated score UI, then transitions into chat.
5. Follow-up questions are streamed with the original resume and conversation history preserved.

## Project Structure

```text
resume-roaster/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.js
│   ├── globals.css
│   ├── layout.js
│   ├── page.jsx
│   └── page.module.css
├── next.config.mjs
├── package.json
└── README.md
```
