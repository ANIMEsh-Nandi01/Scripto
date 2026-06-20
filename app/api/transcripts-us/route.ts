import { handleTranscriptRequest } from "@/lib/transcript-api";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const preferredRegion = "sfo1";

export const POST = handleTranscriptRequest;
