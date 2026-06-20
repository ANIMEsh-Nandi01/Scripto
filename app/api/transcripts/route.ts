import { NextResponse } from "next/server";
import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from "youtube-transcript";
import { formatTime, type TranscriptData } from "@/lib/transcript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
  "youtu.be", "www.youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com",
]);

function parseVideoId(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  const candidate = host.includes("youtu.be")
    ? parts[0]
    : url.searchParams.get("v") ?? (["shorts", "embed", "live"].includes(parts[0]) ? parts[1] : null);
  return candidate && /^[\w-]{11}$/.test(candidate) ? candidate : null;
}

async function getMetadata(videoId: string) {
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const fallback = { title: "YouTube video", channel: "YouTube creator" };
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`, {
      signal: AbortSignal.timeout(6_000), cache: "no-store",
    });
    if (!response.ok) return fallback;
    const data = await response.json() as { title?: string; author_name?: string };
    return { title: data.title || fallback.title, channel: data.author_name || fallback.channel };
  } catch { return fallback; }
}

function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ code, message }, { status });
}

export async function POST(request: Request) {
  let body: { url?: unknown; language?: unknown };
  try { body = await request.json(); } catch { return apiError("INVALID_REQUEST", "Send a valid JSON request.", 400); }

  if (typeof body.url !== "string") return apiError("INVALID_URL", "Enter a valid YouTube URL.", 400);
  const videoId = parseVideoId(body.url.trim());
  if (!videoId) return apiError("INVALID_URL", "Enter a valid YouTube, Shorts, or youtu.be URL.", 400);
  const language = typeof body.language === "string" && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(body.language)
    ? body.language : undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const controlledFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: controller.signal });

  try {
    const [rawSegments, metadata] = await Promise.all([
      YoutubeTranscript.fetchTranscript(videoId, { lang: language, fetch: controlledFetch }),
      getMetadata(videoId),
    ]);
    if (!rawSegments.length) return apiError("NO_CAPTIONS", "No transcript was found for this video.", 404);

    // The upstream package currently returns milliseconds from its InnerTube path
    // and seconds from its legacy XML fallback, so normalize both formats here.
    const sortedDurations = rawSegments.map((segment) => segment.duration).sort((a, b) => a - b);
    const medianDuration = sortedDurations[Math.floor(sortedDurations.length / 2)] ?? 0;
    const unitDivisor = medianDuration > 100 ? 1000 : 1;
    const segments = rawSegments.map((segment) => ({
      text: segment.text.trim(), start: segment.offset / unitDivisor, duration: segment.duration / unitDivisor,
    })).filter((segment) => segment.text.length > 0);
    const totalSeconds = Math.max(...segments.map((segment) => segment.start + segment.duration));
    const selectedLanguage = rawSegments.find((segment) => segment.lang)?.lang ?? language ?? "en";
    const data: TranscriptData = {
      video: {
        id: videoId, url: `https://www.youtube.com/watch?v=${videoId}`,
        title: metadata.title, channel: metadata.channel,
        duration: formatTime(totalSeconds), thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      },
      language: selectedLanguage,
      languages: [selectedLanguage],
      segments,
    };
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    if (error instanceof YoutubeTranscriptTooManyRequestError) return apiError("RATE_LIMITED", "YouTube is temporarily limiting transcript requests. Try again shortly.", 429);
    if (error instanceof YoutubeTranscriptVideoUnavailableError) return apiError("VIDEO_UNAVAILABLE", "This video is private, removed, or unavailable.", 404);
    if (error instanceof YoutubeTranscriptDisabledError) return apiError("CAPTIONS_DISABLED", "The creator has disabled captions for this video.", 404);
    if (error instanceof YoutubeTranscriptNotAvailableLanguageError) return apiError("LANGUAGE_UNAVAILABLE", error.message, 422);
    if (error instanceof YoutubeTranscriptNotAvailableError) return apiError("NO_CAPTIONS", "No transcript is available for this video.", 404);
    if (controller.signal.aborted) return apiError("TIMEOUT", "YouTube took too long to respond. Please try again.", 504);
    console.error("Transcript fetch failed", error);
    return apiError("FETCH_FAILED", "We could not fetch this transcript. The video may be restricted or YouTube may be blocking requests.", 502);
  } finally {
    clearTimeout(timeout);
  }
}
