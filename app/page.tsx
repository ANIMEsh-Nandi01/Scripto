"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
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
      const response = await fetch("/api/transcripts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, language: language ?? null }),
      });
      const payload = await response.json() as TranscriptData | TranscriptApiError;
      if (!response.ok) throw payload;
      setData(payload as TranscriptData); setStatus("ready");
    } catch (cause) {
      const failure = cause as Partial<TranscriptApiError>;
      setApiError({ code: failure.code ?? "NETWORK_ERROR", message: failure.message ?? "Could not reach the transcript service. Check your connection and try again." });
      setStatus("error");
    }
  };

  const reset = () => { setStatus("idle"); setData(null); setApiError(null); setError(""); };

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
        {status === "error" && <motion.div key="unavailable" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto grid min-h-[65vh] max-w-lg place-items-center px-6 text-center"><div className="glass rounded-[32px] p-9"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-300/10 text-2xl">◌</span><p className="text-xs font-semibold uppercase tracking-widest text-orange-200/70">{apiError?.code.replaceAll("_", " ")}</p><h1 className="display mt-3 text-2xl font-semibold">Transcript unavailable</h1><p className="mt-3 text-sm leading-6 text-white/45">{apiError?.message}</p><div className="mt-7 flex justify-center gap-2"><button onClick={() => void submit(lastUrl)} className="focus-ring rounded-2xl bg-[var(--lime)] px-5 py-3 text-sm font-semibold text-black">Try again</button><button onClick={reset} className="focus-ring rounded-2xl bg-white/[.06] px-5 py-3 text-sm">Use another link</button></div></div></motion.div>}
      </AnimatePresence>
    </div>
  );
}
