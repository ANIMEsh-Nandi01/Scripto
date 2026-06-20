# Scripto

A glass-style YouTube transcript reader built with Next.js. Transcript extraction runs server-side through the open-source `youtube-transcript` package; no YouTube API key or OAuth setup is required.

Created by **Animesh Nandi**.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, paste a public YouTube URL, and select **Get transcript**.

## API

`POST /api/transcripts`

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "language": null
}
```

The response contains video metadata, the selected language, and normalized transcript segments with `text`, `start`, and `duration` values in seconds.

## Limitations

Transcript extraction uses YouTube's unofficial caption endpoints. Videos without captions, private or age-restricted videos, and temporary YouTube rate limits can prevent extraction. Hosting providers with shared datacenter IPs may encounter rate limits more often than a local connection.
