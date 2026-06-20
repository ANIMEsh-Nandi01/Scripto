export type TranscriptSegment = {
  text: string;
  start: number;
  duration: number;
};

export type TranscriptVideo = {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
};

export type TranscriptData = {
  video: TranscriptVideo;
  language: string;
  languages: string[];
  segments: TranscriptSegment[];
};

export type TranscriptApiError = {
  code: string;
  message: string;
};

export function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = String(Math.floor(seconds % 60)).padStart(2, "0");
  return hours ? `${hours}:${String(mins).padStart(2, "0")}:${secs}` : `${mins}:${secs}`;
}

export function languageName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}
