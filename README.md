# Brahim ChatBot

## Look Here
- https://brahimchatbot.netlify.app/

A lightweight AI chat app built with React, Vite, and Google Gemini. Assistant replies stream into the conversation as they are generated and render Markdown formatting such as headings, lists, and bold text.

## Features

- Streamed Gemini responses
- Markdown-rendered assistant messages
- Conversation history sent with each chat request
- Responsive chat interface with loading and error states
- Server-side API key handling; the Gemini key is not included in the frontend bundle

## Tech stack

- React 19 and Vite
- Google GenAI SDK (`@google/genai`)
- Gemini `gemini-3.1-flash-lite`
- `react-markdown`
- Node.js HTTP server

## Prerequisites

- Node.js 22.9 or later (`npm run server` uses Node's `--env-file-if-exists` option)
- npm
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Gemini

Copy `.env.example` to `.env.local`, then replace the placeholder with your Gemini API key:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

The `.env.local` file is ignored by Git. Keep the key out of frontend code, commits, screenshots, and public messages. If a key has been exposed, revoke it in Google AI Studio and create a replacement.

### 3. Start the API server

In the first terminal:

```bash
npm run server
```

The API listens on `127.0.0.1:3001` by default. To use a different port, set `API_PORT` before starting the server.

### 4. Start the frontend

In a second terminal:

```bash
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`. In development, Vite forwards `/api` requests to `http://127.0.0.1:3001`.

## npm scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run server` | Start the Gemini chat API |
| `npm run build` | Build the frontend into `dist/` |
| `npm run preview` | Preview the production frontend build |
| `npm run lint` | Run ESLint |

## API reference

### `POST /api/chat`

Accepts the conversation as JSON and returns a streamed response using newline-delimited JSON (NDJSON). Each line is a separate JSON event.

Request content type: `application/json`

```json
{
  "messages": [
    { "role": "user", "content": "What is photosynthesis?" }
  ]
}
```

Each message must have a `role` of `user` or `assistant` and non-empty string `content`. The request is limited to 30 messages, 8,000 characters per message, a 30,000-character assembled prompt (including role labels and separators), and a 50 KB request body. The final message must be from the user.

Successful stream (`Content-Type: application/x-ndjson`):

```json
{"type":"delta","text":"Photosynthesis "}
{"type":"delta","text":"is how plants..."}
{"type":"done"}
```

If an error occurs before streaming starts, the API responds with a JSON error and a non-2xx HTTP status. If it occurs after streaming starts, it sends an `error` event when the connection is still writable.

### `GET /api/health`

Returns `{"ok":true}` when the API process is running. It does not check Gemini credentials, connectivity, or model availability.

## Project structure

```text
api/
  server.js       Node.js API server and Gemini integration
src/
  App.jsx         Chat UI, streamed response handling, and Markdown rendering
  index.css       Application styles
  main.jsx        React entry point
.env.example      Environment-variable template
vite.config.js    Vite configuration and development API proxy
```

## Production deployment

Build the static frontend:

```bash
npm run build
```

The generated site is in `dist/`. The chat API must also run on a trusted server with `GEMINI_API_KEY` set as a server-side environment secret. The API currently binds to `127.0.0.1`, so place a reverse proxy on the same host to forward `/api/*` requests to it. The proxy in `vite.config.js` is for local development only.

The API does not include user authentication or rate limiting. Before making it reachable from the public internet, add appropriate access controls, request limits, and abuse protection. Never expose the Gemini key to the browser.

## Troubleshooting

- **Cannot reach the chat API:** Make sure `npm run server` is running and that the Vite proxy target and API port match.
- **Missing API key:** Check that `.env.local` exists in the project root and contains a non-empty `GEMINI_API_KEY`. Restart the API server after changing the file.
- **AI service is busy or times out:** Retry later; model availability and response times can vary.
- **Responses do not stream:** Restart the API and frontend after code changes, and confirm `/api` requests reach this project's API server without response buffering.
- **Port `3001` is already in use:** Choose another `API_PORT` and update the `/api` target in `vite.config.js` to the same port.
