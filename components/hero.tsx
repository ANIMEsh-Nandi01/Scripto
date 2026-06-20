"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Link2, Play } from "lucide-react";
import { motion } from "motion/react";

type Props = { onSubmit: (url: string) => void; error?: string };

export function Hero({ onSubmit, error }: Props) {
  const [url, setUrl] = useState("");
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit(url); };

  return (
    <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-5xl px-5 pb-20 pt-16 text-center md:pt-24">
      <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-lime-200/15 bg-lime-200/[.07] px-3.5 py-2 text-xs font-medium text-lime-100">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--lime)] shadow-[0_0_14px_var(--lime)]" />
        Your videos, now readable
      </div>
      <h1 className="display mx-auto max-w-4xl text-balance text-5xl font-semibold leading-[1.02] tracking-[-.055em] sm:text-6xl md:text-[82px]">
        Turn any video into <span className="text-[var(--lime)]">clear text.</span>
      </h1>
      <p className="mx-auto mt-7 max-w-2xl text-pretty text-base leading-7 text-white/50 sm:text-lg">
        Paste a YouTube link. Get a clean, searchable transcript you can copy, scan, or take anywhere.
      </p>
      <form onSubmit={submit} className="glass mx-auto mt-10 flex max-w-3xl flex-col gap-2 rounded-[28px] p-2.5 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-3 px-3 sm:px-4">
          <Link2 className="h-5 w-5 shrink-0 text-white/35" aria-hidden="true" />
          <span className="sr-only">YouTube URL</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className="focus-ring min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/30 sm:text-base" placeholder="Paste a YouTube link..." aria-describedby={error ? "url-error" : undefined} />
        </label>
        <button className="focus-ring flex items-center justify-center gap-2 rounded-[20px] bg-[var(--lime)] px-6 py-4 text-sm font-semibold text-[#10120b] transition hover:brightness-110 active:scale-[.98]" type="submit">
          Get transcript <ArrowRight className="h-4 w-4" />
        </button>
      </form>
      <div className="mt-3 min-h-6">
        {error ? <p id="url-error" role="alert" className="text-sm text-red-300">{error}</p> : (
          <button onClick={() => onSubmit("https://www.youtube.com/watch?v=dQw4w9WgXcQ")} className="focus-ring inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-white/35 transition hover:text-white/70">
            <Play className="h-3 w-3 fill-current" /> Try an example video
          </button>
        )}
      </div>
      <div id="how-it-works" className="mx-auto mt-20 grid max-w-4xl gap-3 text-left sm:grid-cols-3">
        {[['01', 'Paste a link', 'Drop in any public YouTube URL.'], ['02', 'We find the words', 'Captions become clean, timed text.'], ['03', 'Make it useful', 'Search, copy, or export in a click.']].map(([n, title, body]) => (
          <div key={n} className="glass-soft rounded-3xl p-5">
            <span className="text-xs font-semibold text-[var(--lime)]">{n}</span>
            <h2 className="display mt-8 font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/40">{body}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
