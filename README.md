# Resume Roaster

Resume Roaster is a production-ready Next.js app for Indian CS students and job seekers who want genuinely useful resume feedback, not polite filler. The topic was chosen because most early-career resumes are packed with vague bullets, overused buzzwords, and weak proof of impact, and direct feedback helps people improve faster.

## Features

- Upload PDF resumes for server-side parsing and feedback
- Upload DOCX resumes for server-side parsing and feedback
- Paste resume text directly into the app
- Rotating loading messages while Gemini generates the roast
- Structured output with separate roast and fixes sections
- Copy feedback button for quick sharing or reuse

## Setup

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file in the project root:

```bash
GEMINI_API_KEY=your_key_here
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

## Get A Free Gemini API Key

1. Go to [aistudio.google.com](https://aistudio.google.com).
2. Sign in with your Google account.
3. Click `Get API key`.
4. Create a key and paste it into `.env.local` as `GEMINI_API_KEY`.

The key is only used server-side in `app/api/chat/route.js`. It is never exposed in the frontend bundle.

## Deploy To Vercel

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Add `GEMINI_API_KEY` in the Vercel project environment variables.
4. Deploy.

Vercel will build the Next.js app and run the resume parsing plus Gemini roast flow on the server.

## How It Works

1. The user uploads a PDF or DOCX file, or pastes resume text manually.
2. The server extracts resume text from the uploaded file with `pdf-parse` or `mammoth`.
3. The parsed text is sent to Gemini with a structured roast prompt.
4. The app renders the roast and fixes in a clean, formatted result card.

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

## File Guide

- `app/layout.js`: App Router layout and metadata.
- `app/globals.css`: Base resets and global typography styles.
- `app/page.jsx`: Client-side upload, paste, loading, result, and copy interactions.
- `app/page.module.css`: Component-scoped styles for the product UI.
- `app/api/chat/route.js`: Server route for file parsing, validation, and Gemini requests.
- `next.config.mjs`: Next.js configuration for server-side packages.
- `package.json`: Scripts and dependencies.
- `README.md`: Setup, deployment, and architecture overview.
