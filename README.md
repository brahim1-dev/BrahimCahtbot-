# Brahim ChatBot

A lightweight AI chat application built with React and Google Gemini. Messages stream into the conversation as the model generates its response, and assistant replies support Markdown formatting.

## Features

- Live, streamed responses from Gemini
- Markdown-formatted assistant replies, including headings, lists, and bold text
- Conversation history is included with each request
- Responsive chat interface with clear loading and error states
- Gemini API key kept on the server, not exposed in the browser bundle

## Technology

- React 19 and Vite
- Google GenAI SDK (`@google/genai`)
- Gemini `gemini-3.1-flash-lite`
- `react-markdown` for rendering assistant responses
- Node.js HTTP server for the private chat API

## Requirements

- Node.js 22.9 or later (the project uses Node's `--env-file-if-exists` option)
- npm
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the API key

Copy `.env.example` to `.env.local` and replace the placeholder with your Gemini API key:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

`.env.local` is excluded from Git. Never put the key in frontend code, commit it, or share it publicly. If a key has been exposed, revoke it in Google AI Studio and create a replacement.

### 3. Start the chat API

In a terminal, run:

```bash
npm run server
```

The API listens on `http://127.0.0.1:3001` by default. You can set `API_PORT` to use a different port.

### 4. Start the web app

In a second terminal, run:

```bash
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). During development, Vite forwards `/api` requests to the local API server.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run server` | Start the Gemini-backed chat API |
| `npm run build` | Create the production frontend in `dist/` |
| `npm run preview` | Preview the production frontend build |
| `npm run lint` | Run ESLint |

## API

### `POST /api/chat`

Accepts the conversation so far and streams the assistant response as newline-delimited JSON.

Request:

```json
{
  "messages": [
    { "role": "user", "content": "What is photosynthesis?" }
  ]
}
```

Stream events:

```json
{"type":"delta","text":"Photosynthesis "}
{"type":"delta","text":"is how plants..."}
{"type":"done"}
```

If a request fails after streaming begins, the API sends an `error` event when possible. Before streaming begins, it returns a JSON error response with an appropriate HTTP status.

### `GET /api/health`

Returns `{"ok":true}` when the API server is running. This only checks server availability; it does not verify Gemini credentials or model availability.

## Project structure

```text
api/
  server.js       Node.js API server and Gemini integration
src/
  App.jsx         Chat interface and streaming client
  index.css       Application styles
  main.jsx        React entry point
.env.example      Safe environment-variable template
vite.config.js    Vite configuration and development API proxy
```

## Production deployment

Build the frontend with:

```bash
npm run build
```

This creates static files in `dist/`. The chat API must also run on a trusted server with `GEMINI_API_KEY` configured as a server-side secret. In production, configure your hosting provider or reverse proxy to route `/api/*` requests to the API server; the proxy in `vite.config.js` is for local development only. Do not expose the API key to the browser or publish the API server without suitable access controls and usage limits.

## Troubleshooting

- **The app says it cannot reach the chat API:** Confirm `npm run server` is running and listening on port `3001`.
- **The API reports a missing key:** Confirm `.env.local` exists in the project root and contains a non-empty `GEMINI_API_KEY`.
- **The AI service is temporarily busy or times out:** Retry after a short wait. The service or model may be temporarily unavailable.
- **The response is not streaming:** Restart both the API server and Vite development server after code changes. Ensure the request is routed to this project's API server.
- **Port `3001` is already in use:** Set `API_PORT` to an available port and update the `/api` proxy target in `vite.config.js` to match.
