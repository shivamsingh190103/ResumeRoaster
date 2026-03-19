"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

const LANDING_STATS = [
  { value: "8", label: "Dimensions scored" },
  { value: "100%", label: "Free to use" },
  { value: "0", label: "Sugarcoating" },
];

const FOLLOW_UP_CHIPS = [
  "Rewrite fix #1 with STAR method",
  "Give me 3 strong bullet rewrites",
  "How do I show impact without metrics?",
  "What skills should I add for SDE roles?",
];

const LOADING_MESSAGES = [
  "Reading your resume...",
  "Scanning for weak verbs...",
  "Counting the buzzwords...",
  "Calculating your score...",
  "Preparing the verdict...",
  "Almost done...",
];

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

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_CHARACTERS = 6000;
const MIN_RESUME_LENGTH = 60;
const SCORE_REVEAL_DELAY = 3000;
const RING_RADIUS = 70;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function formatFileSize(size) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function isSupportedFile(file) {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith(".pdf") || lowerName.endsWith(".doc") || lowerName.endsWith(".docx");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getScoreTone(score) {
  if (score <= 40) {
    return {
      color: "#E24B4A",
      light: "#FCEBEB",
      label: "Critical — Needs Immediate Work",
      shortLabel: "Critical",
    };
  }

  if (score <= 65) {
    return {
      color: "#EF9F27",
      light: "#FAEEDA",
      label: "Below Average — Several Issues",
      shortLabel: "Needs Work",
    };
  }

  if (score <= 85) {
    return {
      color: "#378ADD",
      light: "#E6F1FB",
      label: "Average — Good Foundation",
      shortLabel: "Getting There",
    };
  }

  return {
    color: "#1D9E75",
    light: "#E1F5EE",
    label: "Strong — Minor Polish Needed",
    shortLabel: "Strong",
  };
}

function normalizeDimensions(dimensions) {
  const map = new Map();

  if (Array.isArray(dimensions)) {
    for (const dimension of dimensions) {
      const name = typeof dimension?.name === "string" ? dimension.name.trim() : "";
      if (!name) {
        continue;
      }

      map.set(name.toLowerCase(), clamp(Number(dimension.score) || 0, 0, 10));
    }
  }

  return SCORE_DIMENSIONS.map((name) => ({
    name,
    score: map.get(name.toLowerCase()) ?? 0,
  }));
}

function parseEmbeddedJson(value) {
  const normalized = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");
  const candidate =
    firstBrace !== -1 && lastBrace !== -1 ? normalized.slice(firstBrace, lastBrace + 1) : normalized;

  return JSON.parse(candidate);
}

function parseInitialResponse(fullText) {
  const resumeMatch = fullText.match(/RESUME_CONTEXT_START\s*([\s\S]*?)\s*RESUME_CONTEXT_END/);
  const scoreMatch = fullText.match(/SCORE_DATA_START\s*([\s\S]*?)\s*SCORE_DATA_END/);

  let parsedResumeText = "";
  let parsedScoreData = null;

  if (resumeMatch) {
    try {
      const parsed = parseEmbeddedJson(resumeMatch[1]);
      parsedResumeText = typeof parsed?.resumeText === "string" ? parsed.resumeText : "";
    } catch {
      parsedResumeText = "";
    }
  }

  if (scoreMatch) {
    try {
      const parsed = parseEmbeddedJson(scoreMatch[1]);
      const dimensions = normalizeDimensions(parsed?.dimensions);
      const fallbackTotal = Math.round(
        (dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length) * 10,
      );
      parsedScoreData = {
        total: clamp(Number(parsed?.total) || fallbackTotal, 0, 100),
        dimensions,
      };
    } catch {
      parsedScoreData = null;
    }
  }

  const cleanText = fullText
    .replace(/RESUME_CONTEXT_START[\s\S]*?RESUME_CONTEXT_END\s*/g, "")
    .replace(/SCORE_DATA_START[\s\S]*?SCORE_DATA_END\s*/g, "")
    .trim();

  return { parsedResumeText, parsedScoreData, cleanText };
}

function parseFormattedRoast(content) {
  const normalized = content.replace(/\r/g, "").trim();
  const roastSplit = normalized.split(/#*\s*\**THE ROAST\**\s*/i);
  const afterRoast = roastSplit.length > 1 ? roastSplit.slice(1).join("THE ROAST").trim() : normalized;
  const fixSplit = afterRoast.split(/#*\s*\**THE FIXES\**\s*/i);
  const roastSection = (fixSplit[0] || "").trim();
  const fixesSection = (fixSplit[1] || "").trim();

  const roastParagraphs = roastSection
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const allLines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const lastLine = allLines[allLines.length - 1] || "";
  const encouragement =
    lastLine &&
    !/^#*\s*\**THE (ROAST|FIXES)\**/i.test(lastLine) &&
    !/^\d+\.\s/.test(lastLine) &&
    !/^What's wrong:/i.test(lastLine) &&
    !/^✗\s*Before:/i.test(lastLine) &&
    !/^✓\s*After:/i.test(lastLine)
      ? lastLine
      : "";

  const fixBlocks = fixesSection
    .split(/\n(?=\d+\.\s)/)
    .map((block) => block.trim())
    .filter(Boolean);

  const fixes = fixBlocks.map((block, index) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (index === fixBlocks.length - 1 && encouragement && lines[lines.length - 1] === encouragement) {
      lines.pop();
    }

    const titleLine = (lines[0] || "").replace(/^\d+\.\s*/, "");
    const severityMatch = titleLine.match(/\[SEVERITY:\s*(CRITICAL|MODERATE|MINOR)\]/i);
    const severity = severityMatch ? severityMatch[1].toUpperCase() : "MODERATE";
    const title = titleLine.replace(/\[SEVERITY:[^\]]+\]/i, "").trim();

    const whatsWrongLine = lines.find((line) => /^What's wrong:/i.test(line)) || "";
    const beforeLine = lines.find((line) => /^✗\s*Before:/i.test(line)) || "";
    const afterLine = lines.find((line) => /^✓\s*After:/i.test(line)) || "";

    const bodyLines = lines.filter(
      (line, lineIndex) =>
        lineIndex > 0 &&
        !/^What's wrong:/i.test(line) &&
        !/^✗\s*Before:/i.test(line) &&
        !/^✓\s*After:/i.test(line),
    );

    return {
      title,
      severity,
      whatsWrong:
        whatsWrongLine.replace(/^What's wrong:\s*/i, "").trim() || bodyLines.join(" ").trim(),
      before: beforeLine.replace(/^✗\s*Before:\s*/i, "").replace(/^"|"$/g, "").trim(),
      after: afterLine.replace(/^✓\s*After:\s*/i, "").replace(/^"|"$/g, "").trim(),
    };
  });

  return { roastParagraphs, fixes, encouragement };
}

function getShareSummary(scoreData, parsedRoast) {
  const fixesSummary = parsedRoast.fixes
    .slice(0, 3)
    .map((fix, index) => `${index + 1}. ${fix.title || fix.whatsWrong}`)
    .join("\n");

  return [
    `Resume Roaster score: ${scoreData.total}/100`,
    scoreData.label,
    "",
    "Top fixes:",
    fixesSummary,
  ]
    .filter(Boolean)
    .join("\n");
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 15V3m0 0L8 7m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M8 3.75h6.5L19 8.25V20H8A2.25 2.25 0 015.75 17.75V6A2.25 2.25 0 018 3.75Z" />
      <path d="M14.5 3.75v4.5H19" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 12.5 4 4L18 8.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 7 17 17M17 7 7 17" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SeverityBadge({ severity }) {
  const normalizedSeverity = severity.toUpperCase();
  const toneClass =
    normalizedSeverity === "CRITICAL"
      ? styles.severityCritical
      : normalizedSeverity === "MINOR"
        ? styles.severityMinor
        : styles.severityModerate;

  return <span className={`${styles.severityBadge} ${toneClass}`}>{normalizedSeverity}</span>;
}

function renderMessageContent(content, isFirst) {
  if (!isFirst) {
    return <p className={styles.messageParagraph}>{content}</p>;
  }

  const parsed = parseFormattedRoast(content);

  return (
    <div className={styles.formattedMessage}>
      <div className={styles.messageSection}>
        <div className={styles.sectionHeading}>THE ROAST</div>
        <div className={styles.sectionParagraphs}>
          {parsed.roastParagraphs.map((paragraph, index) => (
            <p key={`roast-${index}-${paragraph}`} className={styles.messageParagraph}>
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      <div className={styles.messageSection}>
        <div className={styles.sectionHeading}>THE FIXES</div>
        <div className={styles.fixList}>
          {parsed.fixes.map((fix, index) => (
            <div key={`fix-${index}-${fix.title}`} className={styles.fixCard}>
              <div className={styles.fixHeader}>
                <div>
                  <p className={styles.fixTitle}>{fix.title || `Fix ${index + 1}`}</p>
                  {fix.whatsWrong ? <p className={styles.fixDescription}>{fix.whatsWrong}</p> : null}
                </div>
                <SeverityBadge severity={fix.severity} />
              </div>
              {fix.before ? (
                <div className={styles.beforeBlock}>
                  <span className={styles.beforeLabel}>✗ Before:</span>
                  <code className={styles.exampleCode}>{fix.before}</code>
                </div>
              ) : null}
              {fix.after ? (
                <div className={styles.afterBlock}>
                  <span className={styles.afterLabel}>✓ After:</span>
                  <code className={styles.exampleCode}>{fix.after}</code>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {parsed.encouragement ? <p className={styles.encouragement}>{parsed.encouragement}</p> : null}
    </div>
  );
}

export default function HomePage() {
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const chatEndRef = useRef(null);

  const [phase, setPhase] = useState("upload");
  const [activeTab, setActiveTab] = useState("upload");
  const [selectedFile, setSelectedFile] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [scoreData, setScoreData] = useState(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [messages, setMessages] = useState([]);
  const [streamingText, setStreamingText] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [showChips, setShowChips] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [scoreAnimationReady, setScoreAnimationReady] = useState(false);

  const normalizedDimensions = normalizeDimensions(scoreData?.dimensions);
  const scoreTone = getScoreTone(scoreData?.total || 0);
  const ringOffset =
    scoreData && scoreAnimationReady
      ? RING_CIRCUMFERENCE * (1 - clamp(scoreData.total, 0, 100) / 100)
      : RING_CIRCUMFERENCE;
  const firstAssistantMessage = messages.find((message) => message.role === "assistant" && message.isFirst);
  const parsedFirstMessage = firstAssistantMessage ? parseFormattedRoast(firstAssistantMessage.content) : null;

  useEffect(() => {
    if (phase !== "loading") {
      return undefined;
    }

    let index = 0;
    setLoadingMsg(LOADING_MESSAGES[index]);

    const intervalId = window.setInterval(() => {
      index = (index + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[index]);
    }, 2200);

    return () => window.clearInterval(intervalId);
  }, [phase]);

  useEffect(() => {
    if (phase !== "score" || !scoreData) {
      setDisplayScore(0);
      return undefined;
    }

    let current = 0;
    const target = scoreData.total;
    const duration = 1500;
    const increment = target / (duration / 16);

    const timer = window.setInterval(() => {
      current = Math.min(current + increment, target);
      setDisplayScore(Math.floor(current));

      if (current >= target) {
        window.clearInterval(timer);
      }
    }, 16);

    return () => window.clearInterval(timer);
  }, [phase, scoreData]);

  useEffect(() => {
    if (phase !== "score") {
      setScoreAnimationReady(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setScoreAnimationReady(true);
    }, 60);

    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "score") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setPhase("chat");
    }, SCORE_REVEAL_DELAY);

    return () => window.clearTimeout(timeoutId);
  }, [phase]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, loading]);

  useEffect(() => {
    if (!copied && !shareCopied) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
      setShareCopied(false);
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [copied, shareCopied]);

  useEffect(() => {
    if (phase === "chat") {
      window.requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.style.height = "44px";
          inputRef.current.focus();
        }
      });
    }
  }, [phase]);

  function clearFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resizeComposer() {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.style.height = "auto";
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
  }

  function resetComposer() {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.style.height = "44px";
  }

  function handleStartOver() {
    setPhase("upload");
    setActiveTab("upload");
    setSelectedFile(null);
    setPasteText("");
    setCharCount(0);
    setResumeText("");
    setScoreData(null);
    setDisplayScore(0);
    setMessages([]);
    setStreamingText("");
    setInputValue("");
    setLoading(false);
    setLoadingMsg(LOADING_MESSAGES[0]);
    setShowChips(true);
    setError("");
    setCopied(false);
    setShareCopied(false);
    setIsDragOver(false);
    setScoreAnimationReady(false);
    clearFileInput();
    resetComposer();
  }

  function handleTabChange(nextTab) {
    if (nextTab === activeTab) {
      return;
    }

    setActiveTab(nextTab);
    setSelectedFile(null);
    setPasteText("");
    setCharCount(0);
    setError("");
    setIsDragOver(false);
    clearFileInput();
  }

  function handleFileSelection(file) {
    if (!file) {
      return;
    }

    if (!isSupportedFile(file)) {
      setSelectedFile(null);
      setError("Only PDF and Word documents are supported.");
      clearFileInput();
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setError("File too large. Please upload a PDF or Word document under 5MB.");
      clearFileInput();
      return;
    }

    setSelectedFile(file);
    setError("");
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    handleFileSelection(file);
  }

  function handlePasteChange(event) {
    setPasteText(event.target.value);
    setCharCount(event.target.value.length);

    if (error) {
      setError("");
    }
  }

  async function handleInitialRoast() {
    const trimmedPaste = pasteText.trim();

    if (activeTab === "upload" && !selectedFile) {
      setError("Upload a PDF or DOCX resume to continue.");
      return;
    }

    if (activeTab === "text" && trimmedPaste.length < MIN_RESUME_LENGTH) {
      setError("Paste at least 60 characters so the analysis has enough context.");
      return;
    }

    setError("");
    setPhase("loading");
    setScoreData(null);
    setDisplayScore(0);
    setMessages([]);
    setStreamingText("");
    setShowChips(true);
    setCopied(false);
    setShareCopied(false);
    setLoading(false);

    const formData = new FormData();
    if (activeTab === "upload" && selectedFile) {
      formData.append("file", selectedFile);
    } else {
      formData.append("resumeText", trimmedPaste);
    }

    let fullText = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "Something went wrong. Please try again.");
        setPhase("upload");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        fullText += decoder.decode(value, { stream: true });
      }

      fullText += decoder.decode();

      const { parsedResumeText, parsedScoreData, cleanText } = parseInitialResponse(fullText);

      if (!parsedScoreData) {
        setError("We could not calculate your score. Please try again.");
        setPhase("upload");
        return;
      }

      setResumeText(parsedResumeText || trimmedPaste);
      setScoreData(parsedScoreData);
      setMessages([{ role: "assistant", content: cleanText, isFirst: true }]);
      setPhase("score");
    } catch {
      setError("Network error. Please try again.");
      setPhase("upload");
    }
  }

  async function handleFollowUp(textOverride) {
    const nextText = (typeof textOverride === "string" ? textOverride : inputValue).trim();

    if (!nextText || loading) {
      return;
    }

    const userMessage = { role: "user", content: nextText, isFirst: false };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInputValue("");
    setShowChips(false);
    setLoading(true);
    setStreamingText("");
    setCopied(false);
    setShareCopied(false);
    resetComposer();

    let fullText = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumeText,
          messages: updatedMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Sorry, something went wrong. Please try again.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        fullText += decoder.decode(value, { stream: true });
        setStreamingText(fullText);
      }

      fullText += decoder.decode();

      setMessages((previousMessages) => [
        ...previousMessages,
        { role: "assistant", content: fullText.trim(), isFirst: false },
      ]);
      setStreamingText("");
    } catch (requestError) {
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          content: requestError.message || "Sorry, something went wrong. Please try again.",
          isFirst: false,
        },
      ]);
      setStreamingText("");
    } finally {
      setLoading(false);
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }

  async function handleCopyFeedback() {
    if (!firstAssistantMessage) {
      return;
    }

    try {
      await navigator.clipboard.writeText(firstAssistantMessage.content);
      setCopied(true);
      setShareCopied(false);
    } catch {
      setError("Copy failed. Please try again.");
    }
  }

  async function handleShareSummary() {
    if (!firstAssistantMessage || !scoreData || !parsedFirstMessage) {
      return;
    }

    try {
      const summary = getShareSummary(
        {
          total: scoreData.total,
          label: scoreTone.label,
        },
        parsedFirstMessage,
      );
      await navigator.clipboard.writeText(summary);
      setShareCopied(true);
      setCopied(false);
    } catch {
      setError("Sharing failed. Please try again.");
    }
  }

  async function handleChipClick(chipText) {
    setInputValue(chipText);
    await handleFollowUp(chipText);
  }

  function handleChatKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleFollowUp();
    }
  }

  function renderLandingShell(cardContent) {
    return (
      <>
        <header className={styles.navBar}>
          <div className={styles.navInner}>
            <p className={styles.navLogo}>
              Resume <span className={styles.navAccent}>Roaster</span>
            </p>
            <span className={styles.betaTag}>Beta</span>
          </div>
        </header>

        <section className={styles.hero}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            <span>AI-powered resume analysis</span>
          </span>
          <h1 className={styles.title}>
            <span className={styles.heroLine}>Your resume</span>
            <span className={styles.heroLine}>
              is getting <span className={styles.titleAccent}>roasted.</span>
            </span>
          </h1>
          <p className={styles.subtitle}>
            Upload your resume. Get a brutal honest score, specific rewrites, and a real
            conversation to fix every problem.
          </p>
          <div className={styles.statGrid}>
            {LANDING_STATS.map((stat, index) => (
              <div
                key={stat.label}
                className={`${styles.statCell} ${index === LANDING_STATS.length - 1 ? styles.statCellLast : ""}`}
              >
                <p className={styles.statValue}>
                  <span className={styles.statNumber}>{stat.value}</span>
                </p>
                <p className={styles.statLabel}>{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {cardContent}
      </>
    );
  }

  function renderUploadPhase() {
    const uploadZoneStateClass = selectedFile
      ? styles.uploadZoneSuccess
      : isDragOver
        ? styles.uploadZoneDragOver
        : "";

    return renderLandingShell(
      <section className={`${styles.card} ${styles.uploadCard}`}>
          <div className={styles.tabRow} role="tablist" aria-label="Choose how to provide your resume">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "upload"}
              className={`${styles.tabButton} ${activeTab === "upload" ? styles.tabButtonActive : ""}`}
              onClick={() => handleTabChange("upload")}
            >
              <span aria-hidden="true">📎</span>
              <span>Upload File</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "text"}
              className={`${styles.tabButton} ${activeTab === "text" ? styles.tabButtonActive : ""}`}
              onClick={() => handleTabChange("text")}
            >
              <span aria-hidden="true">✏️</span>
              <span>Paste Text</span>
            </button>
          </div>

          {activeTab === "upload" ? (
            <div className={styles.inputPane}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className={styles.hiddenInput}
                aria-label="Upload your resume file"
                onChange={(event) => handleFileSelection(event.target.files?.[0])}
              />

              <div
                className={`${styles.uploadZone} ${uploadZoneStateClass}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget === event.target) {
                    setIsDragOver(false);
                  }
                }}
                onDrop={handleDrop}
              >
                {selectedFile ? (
                  <div className={styles.selectedFileCard}>
                    <div className={styles.selectedFileLeft}>
                      <span className={styles.fileSuccessIcon}>
                        <DocumentIcon />
                      </span>
                      <div className={styles.selectedFileMeta}>
                        <p className={styles.selectedFileName}>{selectedFile.name}</p>
                        <p className={styles.selectedFileSize}>{formatFileSize(selectedFile.size)}</p>
                      </div>
                    </div>
                    <div className={styles.selectedFileActions}>
                      <span className={styles.fileCheckmark}>
                        <CheckIcon />
                      </span>
                      <button
                        type="button"
                        className={styles.removeButton}
                        aria-label="Remove selected file"
                        onClick={() => {
                          setSelectedFile(null);
                          setError("");
                          clearFileInput();
                        }}
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.uploadIllustration}>
                      <UploadIcon />
                    </div>
                    <p className={styles.uploadHeadline}>Drop your resume here</p>
                    <p className={styles.uploadSubline}>PDF or Word doc · Max 5MB</p>
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse files
                    </button>
                  </>
                )}
              </div>

              <div className={styles.dividerRow}>
                <span className={styles.dividerLine} />
                <button type="button" className={styles.dividerText} onClick={() => handleTabChange("text")}>
                  or paste text below
                </button>
                <span className={styles.dividerLine} />
              </div>
            </div>
          ) : (
            <div className={styles.inputPane}>
              <label htmlFor="resume-paste" className={styles.label}>
                Paste resume text
              </label>
              <textarea
                id="resume-paste"
                className={styles.resumeTextarea}
                value={pasteText}
                maxLength={MAX_CHARACTERS}
                placeholder="Paste your complete resume here — include all sections: experience, projects, skills, education..."
                onChange={handlePasteChange}
              />
              <div className={styles.counterRow}>
                <span className={styles.counter}>{charCount} / 6000</span>
              </div>
            </div>
          )}

          <button type="button" className={styles.primaryAction} onClick={handleInitialRoast}>
            Get my score &amp; roast →
          </button>

          <div className={styles.trustRow}>
            <span className={styles.trustItem}>Free forever</span>
            <span className={styles.trustDot} />
            <span className={styles.trustItem}>No sign up</span>
            <span className={styles.trustDot} />
            <span className={styles.trustItem}>Powered by Gemini</span>
          </div>

          {error ? (
            <div className={styles.errorMessage} role="alert">
              {error}
            </div>
          ) : null}
        </section>,
    );
  }

  function renderLoadingPhase() {
    return renderLandingShell(
      <section
        className={`${styles.card} ${styles.uploadCard} ${styles.loadingCard}`}
        aria-live="polite"
        aria-busy="true"
      >
        <div className={styles.loadingBarTrack}>
          <div className={styles.loadingBar} />
        </div>
        <p className={styles.loadingStatus}>{loadingMsg}</p>
      </section>,
    );
  }

  function renderScorePhase() {
    return (
      <section className={`${styles.card} ${styles.scoreCard}`}>
        <p className={styles.scoreMicro}>YOUR RESUME SCORE</p>

        <div className={styles.scoreRingWrap}>
          <svg
            className={styles.scoreRing}
            width="160"
            height="160"
            viewBox="0 0 160 160"
            aria-label={`Resume score: ${scoreData.total} out of 100`}
          >
            <circle cx="80" cy="80" r={RING_RADIUS} className={styles.scoreRingBase} />
            <circle
              cx="80"
              cy="80"
              r={RING_RADIUS}
              className={styles.scoreRingProgress}
              style={{
                stroke: scoreTone.color,
                strokeDasharray: RING_CIRCUMFERENCE,
                strokeDashoffset: ringOffset,
              }}
            />
          </svg>
          <div className={styles.scoreRingCenter}>
            <span className={styles.scoreValue} style={{ color: scoreTone.color }}>
              {displayScore}
            </span>
            <span className={styles.scoreOutOf}>/100</span>
          </div>
        </div>

        <p className={styles.scoreLabel} style={{ color: scoreTone.color }}>
          {scoreTone.label}
        </p>

        <div className={styles.breakdownGrid}>
          {normalizedDimensions.map((dimension) => (
            <div key={dimension.name} className={styles.breakdownRow}>
              <span className={styles.breakdownName}>{dimension.name}</span>
              <div className={styles.breakdownTrack}>
                <span
                  className={styles.breakdownFill}
                  style={{
                    background: scoreTone.color,
                    width: scoreAnimationReady ? `${dimension.score * 10}%` : "0%",
                  }}
                />
              </div>
              <span className={styles.breakdownScore}>{dimension.score}/10</span>
            </div>
          ))}
        </div>

        <button type="button" className={styles.primaryAction} onClick={() => setPhase("chat")}>
          See the full roast →
        </button>
        <p className={styles.scoreFootnote}>Scored by Gemini Flash</p>
      </section>
    );
  }

  function renderChatPhase() {
    return (
      <section className={styles.chatShell}>
        <header className={styles.chatHeader}>
          <div className={styles.chatHeaderLeft}>
            <div className={styles.chatBrand}>
              <span className={styles.chatFlame} aria-hidden="true">
                🔥
              </span>
              <div>
                <p className={styles.chatTitle}>Resume Roaster</p>
                <p className={styles.chatScore} style={{ color: scoreTone.color }}>
                  Score: {scoreData.total}/100
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            className={styles.headerButton}
            aria-label="Start over and upload a new resume"
            onClick={handleStartOver}
          >
            Start over
          </button>
        </header>

        <div className={styles.messageList} aria-live="polite" aria-label="Resume roast chat">
          {messages.map((message, index) =>
            message.role === "assistant" ? (
              <div key={`assistant-${index}-${message.content.slice(0, 20)}`} className={styles.assistantRow}>
                <div className={styles.avatar}>R</div>
                <div className={styles.assistantStack}>
                  <div className={`${styles.assistantBubble} ${message.isFirst ? styles.firstAssistantBubble : ""}`}>
                    {renderMessageContent(message.content, message.isFirst)}
                  </div>

                  {message.isFirst ? (
                    <>
                      <div className={styles.actionRow}>
                        <button type="button" className={styles.inlineAction} onClick={handleCopyFeedback}>
                          📋 {copied ? "Copied!" : "Copy feedback"}
                        </button>
                        <button type="button" className={styles.inlineAction} onClick={handleShareSummary}>
                          🔗 {shareCopied ? "Copied!" : "Share"}
                        </button>
                      </div>

                      {showChips ? (
                        <div className={styles.chipSection}>
                          <p className={styles.chipLabel}>Ask a follow-up:</p>
                          <div className={styles.chipRow}>
                            {FOLLOW_UP_CHIPS.map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                className={styles.chip}
                                onClick={() => handleChipClick(chip)}
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <div key={`user-${index}-${message.content.slice(0, 20)}`} className={styles.userRow}>
                <div className={styles.userBubble}>{message.content}</div>
              </div>
            ),
          )}

          {loading && !streamingText ? (
            <div className={styles.assistantRow}>
              <div className={styles.avatar}>R</div>
              <div className={styles.assistantBubble}>
                <div className={styles.typingDots}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          ) : null}

          {streamingText ? (
            <div className={styles.assistantRow}>
              <div className={styles.avatar}>R</div>
              <div className={styles.assistantBubble}>
                <p className={styles.messageParagraph}>
                  {streamingText}
                  <span className={styles.streamingCursor} />
                </p>
              </div>
            </div>
          ) : null}

          <div ref={chatEndRef} />
        </div>

        <div className={styles.chatInputBar}>
          <textarea
            ref={inputRef}
            className={styles.chatTextarea}
            value={inputValue}
            placeholder="Ask a follow-up about your resume..."
            aria-label="Type your follow-up question"
            onChange={(event) => {
              setInputValue(event.target.value);
              resizeComposer();
            }}
            onInput={resizeComposer}
            onKeyDown={handleChatKeyDown}
          />
          <button
            type="button"
            className={styles.sendButton}
            aria-label="Send message"
            disabled={!inputValue.trim() || loading}
            onClick={() => handleFollowUp()}
          >
            <SendIcon />
          </button>
        </div>
      </section>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {phase === "upload" ? renderUploadPhase() : null}
        {phase === "loading" ? renderLoadingPhase() : null}
        {phase === "score" && scoreData ? renderScorePhase() : null}
        {phase === "chat" && scoreData ? renderChatPhase() : null}
      </div>
    </main>
  );
}
