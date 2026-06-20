"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaptionsOff, RotateCcw, Sparkles, Youtube } from "lucide-react";
import { Hero } from "@/components/hero";
import { TranscriptWorkspace } from "@/components/workspace";
import type { TranscriptApiError, TranscriptData } from "@/lib/transcript";

type Status = "idle" | "loading" | "ready" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [apiError, setApiError] = useState<TranscriptApiError | null>(null);
  const [data, setData] = useState<TranscriptData | null>(null);
  const [lastUrl, setLastUrl] = useState("");
  useEffect(() => { const recent = localStorage.getItem("scripto-recent"); if (recent) void recent; }, []);

  const submit = async (url: string, language?: string) => {
    const valid = /^https:\/\/(www\.|m\.|music\.)?(youtube\.com\/(watch\?[^#]*v=|shorts\/|embed\/|live\/)|youtu\.be\/)[\w?=&-]+/i.test(url);
    if (!valid) { setError("Enter a valid YouTube, Shorts, or youtu.be link."); return; }
    setError(""); setApiError(null); setStatus("loading"); setLastUrl(url); localStorage.setItem("scripto-recent", url);
    try {
      const endpoints = ["/api/transcripts", "/api/transcripts-eu", "/api/transcripts-us"];
      // YouTube can hide an existing caption track from one datacenter while
      // exposing it in another, so even a regional NO_CAPTIONS result must be
      // checked against the remaining Edge locations before it is final.
      const retryableCodes = ["NO_CAPTIONS", "CAPTIONS_DISABLED", "CAPTION_FETCH_BLOCKED", "RATE_LIMITED", "TIMEOUT", "FETCH_FAILED", "NETWORK_ERROR"];
      let finalFailure: TranscriptApiError = { code: "NETWORK_ERROR", message: "Could not reach the transcript service." };

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, language: language ?? null }),
          });
          const payload = await response.json() as TranscriptData | TranscriptApiError;
          if (response.ok) { setData(payload as TranscriptData); setStatus("ready"); return; }
          finalFailure = payload as TranscriptApiError;
          if (!retryableCodes.includes(finalFailure.code)) throw finalFailure;
        } catch (cause) {
          const failure = cause as Partial<TranscriptApiError>;
          finalFailure = { code: failure.code ?? "NETWORK_ERROR", message: failure.message ?? "Could not reach this transcript route.", video: failure.video };
          if (!retryableCodes.includes(finalFailure.code)) throw finalFailure;
        }
      }
      throw finalFailure;
    } catch (cause) {
      const failure = cause as Partial<TranscriptApiError>;
      setApiError({ code: failure.code ?? "NETWORK_ERROR", message: failure.message ?? "Could not reach the transcript service. Check your connection and try again.", video: failure.video });
      setStatus("error");
    }
  };

  const reset = () => { setStatus("idle"); setData(null); setApiError(null); setError(""); };
  const transientError = apiError && ["CAPTION_FETCH_BLOCKED", "RATE_LIMITED", "TIMEOUT", "FETCH_FAILED", "NETWORK_ERROR"].includes(apiError.code);
  const noCaptions = apiError && ["NO_CAPTIONS", "CAPTIONS_DISABLED"].includes(apiError.code);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[-1] mx-auto h-[480px] max-w-5xl bg-[radial-gradient(ellipse_at_top,rgba(215,255,69,.08),transparent_68%)]" />
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <button onClick={reset} className="focus-ring display flex items-center gap-2 rounded-lg text-lg font-bold tracking-[-.04em]"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--lime)] text-black"><Sparkles className="h-4 w-4" /></span>Scripto</button>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary navigation">
          {status === "idle" && <a href="#how-it-works" className="focus-ring hidden rounded-full px-4 py-2 text-sm text-white/45 transition hover:text-white sm:block">How it works</a>}
        </nav>
      </header>

      <AnimatePresence mode="wait">
        {status === "idle" && <Hero key="hero" onSubmit={submit} error={error} />}
        {status === "loading" && <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-6 text-center"><div><div className="glass mx-auto grid h-20 w-20 place-items-center rounded-[28px]"><Sparkles className="h-7 w-7 animate-pulse text-[var(--lime)]" /></div><h1 className="display mt-7 text-2xl font-semibold">Finding the right words…</h1><p className="mt-2 text-sm text-white/40">Reading captions and arranging the transcript.</p><div className="mx-auto mt-7 h-1 w-48 overflow-hidden rounded-full bg-white/5"><motion.div className="h-full bg-[var(--lime)]" initial={{ x: "-100%" }} animate={{ x: "180%" }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }} /></div></div></motion.div>}
        {status === "ready" && data && <TranscriptWorkspace key="workspace" data={data} onReset={reset} />}
        {status === "error" && <motion.main key="unavailable" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto grid min-h-[72vh] max-w-2xl place-items-center px-5 pb-16 text-center"><section className="glass w-full overflow-hidden rounded-[32px] p-3 sm:p-4">{apiError?.video && <div className="relative aspect-video overflow-hidden rounded-[24px] bg-white/5"><img src={apiError.video.thumbnail} alt="" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" /><div className="absolute bottom-4 left-4 right-4 text-left"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-white/60"><Youtube className="h-4 w-4 text-red-400" /> YouTube</div><h1 className="display line-clamp-2 text-xl font-semibold sm:text-2xl">{apiError.video.title}</h1><p className="mt-1 text-sm text-white/55">{apiError.video.channel}</p></div></div>}<div className="px-4 pb-5 pt-8 sm:px-8"><span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${noCaptions ? "bg-lime-200/10 text-[var(--lime)]" : "bg-orange-300/10 text-orange-200"}`}>{noCaptions ? <CaptionsOff className="h-6 w-6" /> : <RotateCcw className="h-6 w-6" />}</span><p className="mt-5 text-xs font-semibold uppercase tracking-widest text-white/35">{apiError?.code.replaceAll("_", " ")}</p><h2 className="display mt-2 text-2xl font-semibold">{noCaptions ? "No captions available" : "Transcript unavailable"}</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/45">{apiError?.message}</p><div className="mt-7 flex flex-wrap justify-center gap-2">{transientError && <button onClick={() => void submit(lastUrl)} className="focus-ring rounded-2xl bg-[var(--lime)] px-5 py-3 text-sm font-semibold text-black">Try again</button>}<button onClick={reset} className={`focus-ring rounded-2xl px-5 py-3 text-sm ${transientError ? "bg-white/[.06]" : "bg-[var(--lime)] font-semibold text-black"}`}>Use another video</button></div></div></section></motion.main>}
      </AnimatePresence>
    </div>
  );
}
