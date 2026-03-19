"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

const FEATURES = [
  "Spots weak bullet points",
  "Calls out buzzword soup",
  "Gives real fixes",
];

const LOADING_MESSAGES = [
  "Reading your resume...",
  "Finding the red flags...",
  "Counting the buzzwords...",
  "Preparing the verdict...",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_CHARACTERS = 5000;
const MIN_RESUME_LENGTH = 60;

function formatFileSize(size) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function isSupportedFile(file) {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith(".pdf") || lowerName.endsWith(".docx");
}

function parseResult(result) {
  const normalized = result.replace(/\r/g, "").trim();

  if (!normalized) {
    return {
      roastParagraphs: [],
      fixes: [],
      encouragement: "",
      hasStructuredContent: false,
      rawText: "",
    };
  }

  const withoutRoastHeading = normalized.includes("THE ROAST")
    ? normalized.split(/THE ROAST/i).slice(1).join("THE ROAST").trim()
    : normalized;

  const [roastSection = "", fixesSection = ""] = withoutRoastHeading.split(/THE FIXES/i);
  const roastParagraphs = roastSection
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const lines = fixesSection
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const fixes = [];
  const encouragementLines = [];

  for (const line of lines) {
    if (/^\d+\.\s+/.test(line)) {
      fixes.push(line.replace(/^\d+\.\s+/, "").trim());
    } else if (fixes.length >= 4) {
      encouragementLines.push(line);
    } else if (fixes.length > 0) {
      fixes[fixes.length - 1] = `${fixes[fixes.length - 1]} ${line}`.trim();
    } else {
      encouragementLines.push(line);
    }
  }

  const encouragement = encouragementLines.join(" ").trim();
  const hasStructuredContent = roastParagraphs.length > 0 || fixes.length > 0;

  return {
    roastParagraphs,
    fixes,
    encouragement,
    hasStructuredContent,
    rawText: normalized,
  };
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.uploadIcon}>
      <path
        d="M12 4v9m0-9 3.5 3.5M12 4 8.5 7.5M5 14.5v2A2.5 2.5 0 0 0 7.5 19h9A2.5 2.5 0 0 0 19 16.5v-2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.fileIcon}>
      <path
        d="M8 3.75h5.75L18.25 8v12.25H8A2.25 2.25 0 0 1 5.75 18V6A2.25 2.25 0 0 1 8 3.75Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M13.75 3.75V8H18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.statusIcon}>
      <path
        d="m6 12.5 4 4L18 8.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.closeIcon}>
      <path
        d="M7 7 17 17M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function HomePage() {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("upload");
  const [selectedFile, setSelectedFile] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiError, setApiError] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const showOutput = loading || Boolean(result) || Boolean(apiError);
  const parsedResult = parseResult(result);

  useEffect(() => {
    if (!loading) {
      setLoadingMessage("");
      return undefined;
    }

    let index = 0;
    setLoadingMessage(LOADING_MESSAGES[index]);

    const intervalId = window.setInterval(() => {
      index = (index + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[index]);
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [loading]);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  function clearFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resetAll() {
    setActiveTab("upload");
    setSelectedFile(null);
    setResumeText("");
    setResult("");
    setLoading(false);
    setError("");
    setApiError("");
    setLoadingMessage("");
    setCopied(false);
    setIsDragging(false);
    clearFileInput();
  }

  function switchTab(nextTab) {
    if (nextTab === activeTab) {
      return;
    }

    setActiveTab(nextTab);
    setSelectedFile(null);
    setResumeText("");
    setError("");
    setApiError("");
    setResult("");
    setCopied(false);
    setIsDragging(false);
    clearFileInput();
  }

  function handleFileSelection(file) {
    if (!file) {
      return;
    }

    if (!isSupportedFile(file)) {
      setSelectedFile(null);
      setError("Only PDF and DOCX files are supported.");
      clearFileInput();
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setError("File too large. Please upload a PDF or DOCX under 5MB.");
      clearFileInput();
      return;
    }

    setSelectedFile(file);
    setError("");
  }

  function handleFileInputChange(event) {
    const file = event.target.files?.[0];
    handleFileSelection(file);
  }

  function handleDragOver(event) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event) {
    if (event.currentTarget === event.target) {
      setIsDragging(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    handleFileSelection(file);
  }

  function validateInput() {
    if (activeTab === "upload") {
      if (!selectedFile) {
        setError("Upload a PDF or DOCX resume before asking for a roast.");
        return false;
      }

      return true;
    }

    if (resumeText.trim().length < MIN_RESUME_LENGTH) {
      setError("Paste at least 60 characters so the roast has something real to work with.");
      return false;
    }

    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validateInput()) {
      return;
    }

    setError("");
    setApiError("");
    setResult("");
    setCopied(false);
    setLoading(true);

    try {
      let response;

      if (activeTab === "upload") {
        const formData = new FormData();
        formData.append("file", selectedFile);

        response = await fetch("/api/chat", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ resume: resumeText.trim() }),
        });
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      if (!data.result) {
        throw new Error("Something went wrong. Please try again.");
      }

      setResult(data.result);
    } catch (requestError) {
      setApiError(requestError.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
    } catch {
      setApiError("Copy failed. You can still select the feedback and copy it manually.");
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.hero}>
          <span className={styles.badge}>AI-powered feedback</span>
          <h1 className={styles.title}>Resume Roaster</h1>
          <p className={styles.subtitle}>
            Upload your resume or paste the text. Get brutally honest, genuinely useful
            feedback.
          </p>
          <div className={styles.featureRow} aria-label="Why Resume Roaster helps">
            {FEATURES.map((feature) => (
              <span key={feature} className={styles.featurePill}>
                {feature}
              </span>
            ))}
          </div>
        </div>

        {!showOutput ? (
          <form className={styles.card} onSubmit={handleSubmit}>
            <div className={styles.toggleRow} role="tablist" aria-label="Choose input mode">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "upload"}
                className={`${styles.toggleButton} ${
                  activeTab === "upload" ? styles.toggleButtonActive : ""
                }`}
                onClick={() => switchTab("upload")}
              >
                Upload File
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "text"}
                className={`${styles.toggleButton} ${
                  activeTab === "text" ? styles.toggleButtonActive : ""
                }`}
                onClick={() => switchTab("text")}
              >
                Paste Text
              </button>
            </div>

            {activeTab === "upload" ? (
              <div className={styles.uploadPanel}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className={styles.hiddenInput}
                  onChange={handleFileInputChange}
                />
                <div
                  className={`${styles.uploadZone} ${isDragging ? styles.uploadZoneActive : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <UploadIcon />
                  <div className={styles.uploadTextGroup}>
                    <p className={styles.uploadTitle}>Drag and drop your resume here</p>
                    <p className={styles.uploadSubtitle}>Supports PDF and DOCX — max 5MB</p>
                  </div>
                  <button
                    type="button"
                    className={styles.browseButton}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Browse file
                  </button>
                </div>

                {selectedFile ? (
                  <div className={styles.fileCard}>
                    <div className={styles.fileInfo}>
                      <FileIcon />
                      <div>
                        <p className={styles.fileName}>{selectedFile.name}</p>
                        <p className={styles.fileMeta}>Ready to roast</p>
                      </div>
                    </div>
                    <div className={styles.fileActions}>
                      <span className={styles.fileSize}>{formatFileSize(selectedFile.size)}</span>
                      <span className={styles.successBadge}>
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
                ) : null}

                {error ? (
                  <p className={styles.inlineError} role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className={styles.textPanel}>
                <label className={styles.label} htmlFor="resume-text">
                  Paste your resume text
                </label>
                <textarea
                  id="resume-text"
                  className={styles.textarea}
                  placeholder="Paste your full resume here — experience, skills, education, projects, everything..."
                  value={resumeText}
                  maxLength={MAX_CHARACTERS}
                  onChange={(event) => {
                    setResumeText(event.target.value);
                    if (error) {
                      setError("");
                    }
                  }}
                />
                <div className={styles.textMeta}>
                  <span className={styles.counter}>{resumeText.length} / 5000</span>
                </div>
                {error ? (
                  <p className={styles.inlineError} role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            )}

            <button type="submit" className={styles.primaryButton} disabled={loading}>
              {loading ? "Roasting..." : "Roast my resume 🔥"}
            </button>
          </form>
        ) : (
          <section className={styles.outputCard} aria-live="polite">
            <p className={styles.verdictLabel}>The verdict</p>

            {loading ? (
              <div className={styles.loadingBlock}>
                <div className={styles.shimmerTrack} aria-hidden="true">
                  <div className={styles.shimmerBar} />
                </div>
                <p className={styles.loadingMessage}>{loadingMessage}</p>
              </div>
            ) : apiError ? (
              <div className={styles.errorState}>
                <p className={styles.outputError} role="alert">
                  {apiError}
                </p>
                <button type="button" className={styles.secondaryButton} onClick={resetAll}>
                  Try again
                </button>
              </div>
            ) : parsedResult.hasStructuredContent ? (
              <>
                <div className={styles.resultBody}>
                  {parsedResult.roastParagraphs.length > 0 ? (
                    <section className={styles.resultSection}>
                      <p className={styles.sectionHeading}>THE ROAST</p>
                      <div className={styles.paragraphStack}>
                        {parsedResult.roastParagraphs.map((paragraph) => (
                          <p key={paragraph} className={styles.resultParagraph}>
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {parsedResult.fixes.length > 0 ? (
                    <section className={styles.resultSection}>
                      <p className={styles.sectionHeading}>THE FIXES</p>
                      <div className={styles.fixList}>
                        {parsedResult.fixes.map((fix, index) => (
                          <div key={`${index + 1}-${fix}`} className={styles.fixItem}>
                            <span className={styles.fixNumber}>{index + 1}.</span>
                            <p className={styles.fixText}>{fix}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {parsedResult.encouragement ? (
                    <p className={styles.encouragement}>{parsedResult.encouragement}</p>
                  ) : null}
                </div>
                <div className={styles.divider} />
                <div className={styles.actionRow}>
                  <button type="button" className={styles.secondaryButton} onClick={resetAll}>
                    Roast another resume
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={handleCopy}>
                    {copied ? "Copied!" : "Copy feedback"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.resultBody}>
                  <p className={styles.rawResultText}>{parsedResult.rawText}</p>
                </div>
                <div className={styles.divider} />
                <div className={styles.actionRow}>
                  <button type="button" className={styles.secondaryButton} onClick={resetAll}>
                    Roast another resume
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={handleCopy}>
                    {copied ? "Copied!" : "Copy feedback"}
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
