"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check, ChevronDown, Clock3, Copy, Download, FileText, Play, RotateCcw, Search, Sparkles, Type, Youtube } from "lucide-react";
import { formatTime, languageName, type TranscriptData, type TranscriptSegment } from "@/lib/transcript";

type Props = { data: TranscriptData; onReset: () => void };

function toSrt(segments: TranscriptSegment[]) {
  const srtTime = (seconds: number) => new Date(seconds * 1000).toISOString().slice(11, 23).replace(".", ",");
  return segments.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.start + s.duration)}\n${s.text}`).join("\n\n");
}

function download(content: string, filename: string, type: string) {
  const href = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = href; link.download = filename; link.click(); URL.revokeObjectURL(href);
}

export function TranscriptWorkspace({ data, onReset }: Props) {
  const { video, segments } = data;
  const [query, setQuery] = useState("");
  const [timestamps, setTimestamps] = useState(true);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const filtered = useMemo(() => segments.filter((s) => s.text.toLowerCase().includes(query.toLowerCase())), [query, segments]);
  const plainText = segments.map((s) => `${timestamps ? `[${formatTime(s.start)}] ` : ""}${s.text}`).join("\n");
  const wordCount = segments.reduce((sum, segment) => sum + segment.text.split(/\s+/).filter(Boolean).length, 0);
  const readMinutes = Math.max(1, Math.ceil(wordCount / 220));
  const copy = async () => { await navigator.clipboard.writeText(plainText); setCopied(true); setTimeout(() => setCopied(false), 1600); };

  return (
    <motion.main initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-[1440px] px-4 pb-28 pt-8 sm:px-6 lg:px-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--lime)]"><Check className="h-3.5 w-3.5" /> Transcript ready</div>
          <h1 className="display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Your transcript</h1>
        </div>
        <button onClick={onReset} className="focus-ring glass-soft flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-white/65 transition hover:text-white"><RotateCcw className="h-4 w-4" /> <span className="hidden sm:inline">New video</span></button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="glass overflow-hidden rounded-[30px] p-3">
            <div className="relative aspect-video overflow-hidden rounded-[22px] bg-[#161a11]">
              <img src={video.thumbnail} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/15" />
              <a href={video.url} target="_blank" rel="noreferrer" aria-label="Play video on YouTube" className="focus-ring absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-black shadow-2xl transition hover:scale-105"><Play className="ml-0.5 h-5 w-5 fill-current" /></a>
              <span className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2 py-1 text-[11px]">{video.duration}</span>
            </div>
            <div className="px-2 pb-2 pt-5">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.18em] text-white/35"><Youtube className="h-4 w-4 text-red-400" /> YouTube</div>
              <h2 className="display text-xl font-semibold leading-snug">{video.title}</h2>
              <p className="mt-2 text-sm text-white/45">{video.channel} · YouTube</p>
            </div>
          </section>

          <section className="glass-soft rounded-[26px] p-5">
            <div className="flex items-center justify-between"><span className="text-sm text-white/45">Language</span><div className="relative"><select aria-label="Transcript language" defaultValue={data.language} className="focus-ring appearance-none bg-transparent py-1 pl-2 pr-7 text-sm outline-none">{data.languages.map((code) => <option key={code} value={code} className="bg-neutral-900">{languageName(code)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-0 top-1.5 h-4 w-4 text-white/40" /></div></div>
            <div className="my-4 h-px bg-white/[.07]" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => download(plainText, "transcript.txt", "text/plain")} className="focus-ring rounded-2xl bg-white/[.055] px-3 py-3 text-left text-sm transition hover:bg-white/10"><FileText className="mb-5 h-4 w-4 text-[var(--lime)]" /> Download .txt</button>
              <button onClick={() => download(toSrt(segments), "transcript.srt", "text/plain")} className="focus-ring rounded-2xl bg-white/[.055] px-3 py-3 text-left text-sm transition hover:bg-white/10"><Download className="mb-5 h-4 w-4 text-[var(--lime)]" /> Download .srt</button>
            </div>
          </section>
        </aside>

        <section className="glass flex min-h-[700px] min-w-0 flex-col overflow-hidden rounded-[30px]">
          <div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row sm:items-center">
            <label className="flex flex-1 items-center gap-3 rounded-2xl bg-white/[.045] px-4"><Search className="h-4 w-4 text-white/35" /><span className="sr-only">Search transcript</span><input value={query} onChange={(e) => setQuery(e.target.value)} className="focus-ring w-full bg-transparent py-3 text-sm outline-none placeholder:text-white/30" placeholder="Search in transcript..." /></label>
            <div className="flex gap-2">
              <button aria-pressed={timestamps} onClick={() => setTimestamps(!timestamps)} className={`focus-ring flex items-center gap-2 rounded-2xl px-4 py-3 text-sm transition ${timestamps ? "bg-lime-200/10 text-lime-100" : "bg-white/[.045] text-white/45"}`}><Clock3 className="h-4 w-4" /> Timestamps</button>
              <button onClick={copy} className="focus-ring flex items-center gap-2 rounded-2xl bg-[var(--lime)] px-4 py-3 text-sm font-semibold text-black transition hover:brightness-110">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} <span className="hidden sm:inline">{copied ? "Copied" : "Copy all"}</span></button>
            </div>
          </div>
          <div className="flex items-center gap-5 border-b border-white/[.06] px-5 py-3 text-xs text-white/35"><span className="flex items-center gap-2"><Type className="h-3.5 w-3.5" /> {segments.length} segments</span><span>{wordCount.toLocaleString()} words</span><span>~{readMinutes} min read</span></div>
          <div className="thin-scrollbar max-h-[720px] flex-1 overflow-y-auto p-3 sm:p-5" aria-live="polite">
            {filtered.length ? filtered.map((segment) => {
              const originalIndex = segments.indexOf(segment); const selected = active === originalIndex;
              return <button key={segment.start} onClick={() => setActive(originalIndex)} className={`focus-ring group flex w-full gap-4 rounded-2xl px-3 py-3.5 text-left transition sm:px-4 ${selected ? "bg-lime-200/[.09]" : "hover:bg-white/[.04]"}`}>
                {timestamps && <span className={`mt-0.5 min-w-10 font-mono text-xs ${selected ? "text-[var(--lime)]" : "text-white/28 group-hover:text-white/50"}`}>{formatTime(segment.start)}</span>}
                <span className={`text-[15px] leading-7 ${selected ? "text-white" : "text-white/64"}`}>{segment.text}</span>
                {selected && <Sparkles className="ml-auto mt-1 h-4 w-4 shrink-0 text-[var(--lime)]" />}
              </button>;
            }) : <div className="grid h-72 place-items-center text-center"><div><Search className="mx-auto h-7 w-7 text-white/20"/><p className="mt-4 text-sm text-white/50">No matching words found.</p><button onClick={() => setQuery("")} className="focus-ring mt-2 rounded-lg px-2 py-1 text-xs text-[var(--lime)]">Clear search</button></div></div>}
          </div>
        </section>
      </div>

      <div className="glass fixed bottom-3 left-1/2 z-40 flex w-[calc(100%-24px)] -translate-x-1/2 items-center justify-between rounded-2xl p-2 lg:hidden">
        <button onClick={onReset} className="focus-ring flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-white/60"><RotateCcw className="h-4 w-4" /> New</button>
        <button onClick={copy} className="focus-ring flex items-center gap-2 rounded-xl bg-[var(--lime)] px-5 py-3 text-sm font-semibold text-black"><Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy all"}</button>
      </div>
    </motion.main>
  );
}
