"use client";

import React, { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Unlock,
  Link2,
  Copy,
  Check,
  Youtube,
  AlertCircle,
  ExternalLink,
  Loader2,
  ArrowRight,
  Play,
  CheckCircle2,
  X,
  Eye,
  RotateCcw,
  UserPlus,
} from "lucide-react";
import {
  validateAndSanitizeUrl,
  encodeLockedPayload,
  decodeLockedPayload,
} from "@/lib/crypto";

interface ToastMessage {
  id: string;
  type: "error" | "success";
  title: string;
  description?: string;
}

type UnlockStage = "locked" | "counting" | "unlocked";

function SubscribeToUnlockContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const encodedParam = searchParams.get("v");

  // Creator View State
  const [channelInputUrl, setChannelInputUrl] = useState("");
  const [videoInputUrl, setVideoInputUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Locked User View State
  const [unlockStage, setUnlockStage] = useState<UnlockStage>("locked");
  const [countdown, setCountdown] = useState<number>(5);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback(
    (type: ToastMessage["type"], title: string, description?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, type, title, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Reset unlock state if URL parameter changes
  useEffect(() => {
    setUnlockStage("locked");
    setCountdown(5);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [encodedParam]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Safe redirect helper
  const performSafeRedirect = useCallback(
    (targetUrl: string) => {
      const check = validateAndSanitizeUrl(targetUrl, "video");
      if (!check.isValid || !check.sanitizedUrl) {
        pushToast(
          "error",
          "Invalid Video Link",
          "Could not open the destination video URL."
        );
        return;
      }
      window.location.assign(check.sanitizedUrl);
    },
    [pushToast]
  );

  // Handle link generation
  const handleGenerateLink = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratedLink(null);
    setCopied(false);

    const channelValidation = validateAndSanitizeUrl(channelInputUrl, "channel");
    if (!channelValidation.isValid || !channelValidation.sanitizedUrl) {
      pushToast(
        "error",
        "Invalid Channel Link",
        channelValidation.error || "Please enter a valid channel link."
      );
      return;
    }

    const videoValidation = validateAndSanitizeUrl(videoInputUrl, "video");
    if (!videoValidation.isValid || !videoValidation.sanitizedUrl) {
      pushToast(
        "error",
        "Invalid Video Link",
        videoValidation.error || "Please enter a valid video link."
      );
      return;
    }

    setIsGenerating(true);
    setTimeout(() => {
      try {
        const token = encodeLockedPayload(
          channelValidation.sanitizedUrl!,
          videoValidation.sanitizedUrl!
        );
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        const pathname =
          typeof window !== "undefined" ? window.location.pathname : "/";
        const fullLockedUrl = `${origin}${pathname}?v=${encodeURIComponent(
          token
        )}`;

        setGeneratedLink(fullLockedUrl);
        pushToast("success", "Link Generated", "Your locked link is ready to share.");
      } catch (err) {
        pushToast(
          "error",
          "Error",
          err instanceof Error ? err.message : "Could not create link."
        );
      } finally {
        setIsGenerating(false);
      }
    }, 250);
  };

  // Copy to clipboard
  const handleCopyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      pushToast("success", "Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      pushToast("error", "Copy failed", "Please select and copy manually.");
    }
  };

  // Subscribe button click
  const handleSubscribeClick = (
    decodedChannelUrl: string,
    decodedTargetVideoUrl: string
  ) => {
    const channelCheck = validateAndSanitizeUrl(decodedChannelUrl, "channel");
    if (!channelCheck.isValid || !channelCheck.sanitizedUrl) {
      pushToast("error", "Invalid Channel Link");
      return;
    }

    // Open channel in a new tab
    window.open(channelCheck.sanitizedUrl, "_blank", "noopener,noreferrer");

    if (unlockStage !== "locked") return;

    setUnlockStage("counting");
    setCountdown(5);

    let remaining = 5;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
      } else {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setCountdown(0);
        setUnlockStage("unlocked");
        performSafeRedirect(decodedTargetVideoUrl);
      }
    }, 1000);
  };

  const isLockedView = Boolean(encodedParam);
  const decodedResult = isLockedView
    ? decodeLockedPayload(encodedParam || "")
    : null;

  return (
    <div className="flex min-h-screen flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
      {/* Toast Notifications */}
      <div
        aria-live="polite"
        className="fixed top-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2 pointer-events-none px-4 sm:px-0"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-xl ${
                toast.type === "error"
                  ? "border-rose-500/25 bg-zinc-900/95 text-rose-100"
                  : "border-emerald-500/25 bg-zinc-900/95 text-emerald-100"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {toast.type === "error" ? (
                  <AlertCircle className="h-4 w-4 text-rose-400" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
              </div>
              <div className="flex-1 text-sm">
                <p className="font-medium text-white">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-lg p-1 text-zinc-500 transition hover:text-zinc-300"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Clean Header */}
      <header className="mx-auto flex w-full max-w-lg items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-2.5 transition hover:opacity-85 text-left"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20">
            <Lock className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-semibold tracking-tight text-white">
            LinkGenie
          </span>
        </button>

        {isLockedView && (
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-xs text-zinc-400 transition hover:text-white"
          >
            Create link
          </button>
        )}
      </header>

      {/* Main Container */}
      <main className="mx-auto my-auto w-full max-w-lg py-8">
        <AnimatePresence mode="wait">
          {!isLockedView ? (
            /* 1. CREATOR PANEL */
            <motion.section
              key="creator-panel"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.25 }}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 p-6 sm:p-8 shadow-glass backdrop-blur-2xl"
            >
              <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Lock a Video
                </h1>
                <p className="mt-1.5 text-sm text-zinc-400">
                  Generate a link that requires viewers to subscribe to your channel before watching.
                </p>
              </div>

              <form onSubmit={handleGenerateLink} className="space-y-4" noValidate>
                {/* Channel Input */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-zinc-300">
                    <label htmlFor="channel-url">YouTube Channel Link</label>
                    <button
                      type="button"
                      onClick={() => {
                        setChannelInputUrl("https://www.youtube.com/@vercel");
                        setVideoInputUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
                      }}
                      className="text-indigo-400 hover:text-indigo-300 transition"
                    >
                      Fill sample
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <UserPlus className="pointer-events-none absolute left-3.5 h-4 w-4 text-zinc-500" />
                    <input
                      id="channel-url"
                      type="text"
                      value={channelInputUrl}
                      onChange={(e) => setChannelInputUrl(e.target.value)}
                      placeholder="youtube.com/@channel"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 py-3 pl-10 pr-9 text-sm text-white placeholder-zinc-500 transition focus:border-indigo-500/60 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                    />
                    {channelInputUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setChannelInputUrl("");
                          setGeneratedLink(null);
                        }}
                        className="absolute right-3 rounded-lg p-1 text-zinc-500 hover:text-zinc-300"
                        aria-label="Clear"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Video Input */}
                <div>
                  <label
                    htmlFor="video-url"
                    className="mb-1.5 block text-xs font-medium text-zinc-300"
                  >
                    YouTube Video Link
                  </label>
                  <div className="relative flex items-center">
                    <Link2 className="pointer-events-none absolute left-3.5 h-4 w-4 text-zinc-500" />
                    <input
                      id="video-url"
                      type="text"
                      value={videoInputUrl}
                      onChange={(e) => setVideoInputUrl(e.target.value)}
                      placeholder="youtube.com/watch?v=..."
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 py-3 pl-10 pr-9 text-sm text-white placeholder-zinc-500 transition focus:border-indigo-500/60 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                    />
                    {videoInputUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setVideoInputUrl("");
                          setGeneratedLink(null);
                        }}
                        className="absolute right-3 rounded-lg p-1 text-zinc-500 hover:text-zinc-300"
                        aria-label="Clear"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={isGenerating}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-5 py-3.5 text-sm font-semibold text-white shadow-glow-indigo transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Generating link...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      <span>Generate Locked Link</span>
                    </>
                  )}
                </motion.button>
              </form>

              {/* Generated Result Container */}
              <AnimatePresence>
                {generatedLink && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 20 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                        <span>Shareable link</span>
                        <button
                          type="button"
                          onClick={() => {
                            const url = new URL(generatedLink);
                            router.push(url.pathname + url.search);
                          }}
                          className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Preview</span>
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="flex-1 truncate rounded-xl border border-white/5 bg-zinc-900/90 px-3 py-2 font-mono text-xs text-zinc-300 select-all">
                          {generatedLink}
                        </div>

                        <motion.button
                          type="button"
                          onClick={handleCopyLink}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition ${
                            copied
                              ? "bg-emerald-500 text-zinc-950 shadow-glow-emerald"
                              : "bg-white text-zinc-950 hover:bg-zinc-200"
                          }`}
                        >
                          {copied ? (
                            <>
                              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy link</span>
                            </>
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          ) : (
            /* 2. USER PANEL (Locked View) */
            <motion.section
              key="user-panel"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.25 }}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 p-6 sm:p-8 shadow-glass backdrop-blur-2xl"
            >
              {!decodedResult?.isValid ||
              !decodedResult.videoUrl ||
              !decodedResult.channelUrl ? (
                /* Error view for invalid token */
                <div className="text-center py-6">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    Link Not Found or Corrupted
                  </h2>
                  <p className="mx-auto mt-1.5 max-w-xs text-xs text-zinc-400">
                    {decodedResult?.error ||
                      "This link is invalid or incomplete."}
                  </p>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push("/")}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white hover:bg-white/10 transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Create a new link</span>
                  </motion.button>
                </div>
              ) : (
                /* Standard Locked view */
                <div>
                  <div className="mb-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        unlockStage === "unlocked"
                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                          : "border-zinc-700 bg-zinc-800/60 text-zinc-300"
                      }`}
                    >
                      {unlockStage === "unlocked" ? (
                        <>
                          <Unlock className="h-3 w-3" />
                          <span>Unlocked</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-3 w-3" />
                          <span>Locked Video</span>
                        </>
                      )}
                    </span>
                  </div>

                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    Subscribe to unlock the video
                  </h1>
                  <p className="mt-1.5 text-sm text-zinc-400">
                    Subscribe to{" "}
                    <span className="font-medium text-zinc-200">
                      {decodedResult.channelHandle || "the channel"}
                    </span>{" "}
                    to unlock this video.
                  </p>

                  {/* Video preview item */}
                  <div className="mt-5 rounded-2xl border border-white/10 bg-zinc-950/60 p-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                          unlockStage === "unlocked"
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                            : "border-white/10 bg-zinc-900 text-zinc-400"
                        }`}
                      >
                        {unlockStage === "unlocked" ? (
                          <Play className="h-4 w-4 fill-current" />
                        ) : (
                          <Lock className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-400">Destination</p>
                        <p className="truncate text-sm font-medium text-zinc-200">
                          {decodedResult.videoId
                            ? `YouTube Video (${decodedResult.videoId})`
                            : "YouTube Video"}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar during countdown */}
                    {unlockStage !== "locked" && (
                      <div className="mt-3.5 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                        <motion.div
                          initial={{ width: "0%" }}
                          animate={{
                            width:
                              unlockStage === "unlocked"
                                ? "100%"
                                : `${((5 - countdown) / 5) * 100}%`,
                          }}
                          transition={{ duration: 0.9, ease: "linear" }}
                          className="h-full rounded-full bg-emerald-400"
                        />
                      </div>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="mt-5 space-y-3">
                    {/* Button 1: Subscribe */}
                    <motion.button
                      type="button"
                      onClick={() =>
                        handleSubscribeClick(
                          decodedResult.channelUrl!,
                          decodedResult.videoUrl!
                        )
                      }
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="group flex w-full items-center justify-between rounded-2xl bg-red-600 hover:bg-red-500 px-4 py-3.5 text-sm font-semibold text-white shadow-md transition"
                    >
                      <span className="flex items-center gap-2.5">
                        <Youtube className="h-4 w-4" />
                        <span>1. Subscribe to Channel</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-red-100 opacity-90">
                        <span>
                          {unlockStage === "locked" ? "Open" : "Opened"}
                        </span>
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    </motion.button>

                    {/* Button 2: Unlock / Watch */}
                    <motion.button
                      type="button"
                      disabled={unlockStage !== "unlocked"}
                      onClick={() =>
                        performSafeRedirect(decodedResult.videoUrl!)
                      }
                      whileHover={
                        unlockStage === "unlocked" ? { scale: 1.01 } : undefined
                      }
                      whileTap={
                        unlockStage === "unlocked" ? { scale: 0.99 } : undefined
                      }
                      className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${
                        unlockStage === "unlocked"
                          ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-glow-emerald cursor-pointer"
                          : "border border-white/5 bg-zinc-800/60 text-zinc-500 cursor-not-allowed"
                      }`}
                    >
                      {unlockStage === "locked" && (
                        <>
                          <Lock className="h-4 w-4" />
                          <span>Unlock Video</span>
                        </>
                      )}

                      {unlockStage === "counting" && (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-zinc-300" />
                          <span className="text-zinc-200">
                            Unlocking in {countdown}s...
                          </span>
                        </>
                      )}

                      {unlockStage === "unlocked" && (
                        <>
                          <Unlock className="h-4 w-4 stroke-[2.5]" />
                          <span>Watch Video</span>
                          <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                        </>
                      )}
                    </motion.button>
                  </div>

                  <div className="mt-5 text-center">
                    <button
                      type="button"
                      onClick={() => router.push("/")}
                      className="text-xs text-zinc-400 hover:text-white transition"
                    >
                      Create your own locked link
                    </button>
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="mx-auto w-full max-w-lg text-center text-xs text-zinc-500">
        LinkGenie
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-2.5 backdrop-blur-xl">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            <span className="text-xs text-zinc-300">Loading...</span>
          </div>
        </div>
      }
    >
      <SubscribeToUnlockContent />
    </Suspense>
  );
}
