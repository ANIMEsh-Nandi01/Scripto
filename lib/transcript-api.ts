import { NextResponse } from "next/server";
import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from "youtube-transcript";
import { getSubtitles } from "youtube-caption-extractor";
import { formatTime, type TranscriptApiError, type TranscriptData, type TranscriptSegment } from "@/lib/transcript";

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

function errorVideo(videoId: string, metadata: { title: string; channel: string }) {
  return {
    id: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: metadata.title,
    channel: metadata.channel,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

function apiError(code: string, message: string, status: number, video?: TranscriptApiError["video"]) {
  return NextResponse.json({ code, message, ...(video ? { video } : {}) }, { status });
}

class CaptionDeliveryBlockedError extends Error {
  constructor() {
    super("YouTube exposed a caption track but returned an empty caption document.");
  }
}

function normalizePrimary(raw: Awaited<ReturnType<typeof YoutubeTranscript.fetchTranscript>>) {
  // The upstream package returns milliseconds from InnerTube and seconds from
  // its legacy XML fallback, so infer and normalize the unit from cue duration.
  const sortedDurations = raw.map((segment) => segment.duration).sort((a, b) => a - b);
  const medianDuration = sortedDurations[Math.floor(sortedDurations.length / 2)] ?? 0;
  const unitDivisor = medianDuration > 100 ? 1000 : 1;
  return raw.map((segment) => ({
    text: segment.text.trim(),
    start: segment.offset / unitDivisor,
    duration: segment.duration / unitDivisor,
  })).filter((segment) => segment.text.length > 0);
}

async function extractTranscript(
  videoId: string,
  language: string | undefined,
  controlledFetch: typeof fetch,
): Promise<{ segments: TranscriptSegment[]; language: string }> {
  let multiClientError: unknown;

  // Start with the maintained multi-client extractor. It rotates through
  // several YouTube clients, which is substantially more resilient on shared
  // serverless egress than the legacy single-client path.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fallback = await getSubtitles({ videoID: videoId, lang: language ?? "en", fetch: controlledFetch });
      const segments = fallback.map((segment) => ({
        text: segment.text.trim(),
        start: Number.parseFloat(segment.start),
        duration: Number.parseFloat(segment.dur),
      })).filter((segment) => segment.text.length > 0 && Number.isFinite(segment.start));
      // A playable response can still omit captions when a particular YouTube
      // client is restricted. Only accept a non-empty result here; verify an
      // empty response with the independent extractor below before reporting
      // that the video genuinely has no captions.
      if (segments.length) return { segments, language: language ?? "en" };
      break;
    } catch (error) {
      multiClientError = error;
      const message = error instanceof Error ? error.message : "";
      const permanent = message.includes("Video unavailable") || message.includes("private");
      if (permanent || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  // Fall back to the older extractor only when every multi-client route failed.
  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId, { lang: language, fetch: controlledFetch });
    const segments = normalizePrimary(raw);
    if (segments.length) {
      return { segments, language: raw.find((segment) => segment.lang)?.lang ?? language ?? "en" };
    }
    throw new CaptionDeliveryBlockedError();
  } catch (error) {
    if (error instanceof CaptionDeliveryBlockedError) throw error;
    const missing = error instanceof YoutubeTranscriptNotAvailableError
      || error instanceof YoutubeTranscriptDisabledError
      || error instanceof YoutubeTranscriptNotAvailableLanguageError;
    if (missing) return { segments: [], language: language ?? "en" };
    // Prefer the typed legacy error when available, while retaining the
    // multi-client failure text for classification if the legacy error is vague.
    if (error instanceof YoutubeTranscriptTooManyRequestError
      || error instanceof YoutubeTranscriptVideoUnavailableError) throw error;
    throw multiClientError ?? error;
  }
}

export async function handleTranscriptRequest(request: Request) {
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
  const metadataPromise = getMetadata(videoId);

  try {
    const [extraction, metadata] = await Promise.all([
      extractTranscript(videoId, language, controlledFetch),
      metadataPromise,
    ]);
    const { segments } = extraction;
    if (!segments.length) {
      return apiError(
        "NO_CAPTIONS",
        "YouTube does not provide a caption track for this video.",
        404,
        errorVideo(videoId, metadata),
      );
    }

    const totalSeconds = Math.max(...segments.map((segment) => segment.start + segment.duration));
    const selectedLanguage = extraction.language;
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
    const metadata = await metadataPromise;
    const video = errorVideo(videoId, metadata);
    if (error instanceof YoutubeTranscriptTooManyRequestError) return apiError("RATE_LIMITED", "YouTube is temporarily limiting transcript requests. Try again shortly.", 429);
    if (error instanceof YoutubeTranscriptVideoUnavailableError) return apiError("VIDEO_UNAVAILABLE", "This video is private, removed, or unavailable.", 404, video);
    if (error instanceof YoutubeTranscriptDisabledError) return apiError("CAPTIONS_DISABLED", "The creator has turned off captions for this video.", 404, video);
    if (error instanceof YoutubeTranscriptNotAvailableLanguageError) return apiError("LANGUAGE_UNAVAILABLE", error.message, 422, video);
    if (error instanceof YoutubeTranscriptNotAvailableError) return apiError("NO_CAPTIONS", "YouTube does not provide a caption track for this video.", 404, video);
    if (error instanceof CaptionDeliveryBlockedError) {
      return apiError(
        "CAPTION_FETCH_BLOCKED",
        "YouTube exposed captions but blocked delivery from this network. We tried multiple regions; please try again shortly.",
        502,
        video,
      );
    }
    if (controller.signal.aborted) return apiError("TIMEOUT", "YouTube took too long to respond. Please try again.", 504);
    const fallbackMessage = error instanceof Error ? error.message : "";
    if (fallbackMessage.includes("Video unavailable") || fallbackMessage.includes("private")) {
      return apiError("VIDEO_UNAVAILABLE", "This video is private, removed, or unavailable.", 404, video);
    }
    if (fallbackMessage.includes("LOGIN_REQUIRED") || fallbackMessage.includes("not a bot") || fallbackMessage.includes("429")) {
      return apiError("RATE_LIMITED", "YouTube is temporarily limiting transcript requests. Try again shortly.", 429);
    }
    console.error("Transcript fetch failed", error);
    return apiError("FETCH_FAILED", "We could not fetch this transcript. The video may be restricted or YouTube may be blocking requests.", 502);
  } finally {
    clearTimeout(timeout);
  }
}
