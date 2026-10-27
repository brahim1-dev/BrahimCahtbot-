import { createServer } from 'node:http'
import { GoogleGenAI } from '@google/genai'

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  console.error('GEMINI_API_KEY is missing. Add it to .env.local before starting the API server.')
  process.exit(1)
}

const geminiTimeoutMs = 30000
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    timeout: geminiTimeoutMs,
    retryOptions: { attempts: 1 },
  },
})
const maxRequestBytes = 50 * 1024
const maxHistoryMessages = 30
const maxMessageLength = 8000
const maxHistoryLength = 30000

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

const readJson = async (request) => {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > maxRequestBytes) {
      const error = new Error('Request body is too large.')
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const error = new Error('Request body must be valid JSON.')
    error.statusCode = 400
    throw error
  }
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/api/health') {
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method !== 'POST' || request.url !== '/api/chat') {
    sendJson(response, 404, { error: 'Not found.' })
    return
  }

  try {
    const body = await readJson(request)
    const { messages } = body ?? {}

    if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > maxHistoryMessages ||
      messages.some(
        (message) =>
          !message ||
          !['user', 'assistant'].includes(message.role) ||
          typeof message.content !== 'string' ||
          !message.content.trim() ||
          message.content.length > maxMessageLength,
      )
    ) {
      sendJson(response, 400, { error: 'Please send a valid chat message.' })
      return
    }

    const history = messages.slice(-maxHistoryMessages)
    const prompt = history
      .map(({ role, content }) => `${role === 'user' ? 'User' : 'Assistant'}: ${content}`)
      .join('\n\n')

    if (prompt.length > maxHistoryLength || history.at(-1).role !== 'user') {
      sendJson(response, 400, { error: 'The conversation is too long or incomplete.' })
      return
    }

    try {
      const stream = await ai.models.generateContentStream({
        model: 'gemini-3.1-flash-lite',
        contents: history.map(({ role, content }) => ({
          role: role === 'assistant' ? 'model' : 'user',
          parts: [{ text: content }],
        })),
        config: {
          systemInstruction: 'You are Brahim ChatBot. Respond clearly and helpfully.',
        },
      })
      const iterator = stream[Symbol.asyncIterator]()
      let next = await iterator.next()

      response.writeHead(200, {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'Transfer-Encoding': 'chunked',
      })

      let hasText = false
      const writeChunk = (chunk) => {
        if (typeof chunk?.text !== 'string' || !chunk.text) return
        hasText = true
        response.write(`${JSON.stringify({ type: 'delta', text: chunk.text })}\n`)
      }

      while (!next.done) {
        writeChunk(next.value)
        next = await iterator.next()
      }

      if (hasText) {
        response.write(`${JSON.stringify({ type: 'done' })}\n`)
      } else {
        console.error('Gemini returned no text response.')
        response.write(`${JSON.stringify({ type: 'error', error: 'The AI service returned an empty response. Please try again.' })}\n`)
      }
      response.end()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Gemini API error.'
      const safeMessage = message.replaceAll(apiKey, '[redacted]').slice(0, 500)
      const status = Number.isInteger(error?.status) ? ` (HTTP ${error.status})` : ''
      console.error(`Gemini request failed${status}: ${safeMessage}`)
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
      const temporarilyUnavailable = error?.status === 429 || error?.status === 503
      const errorMessage = timedOut
        ? 'The AI service took too long to respond. Please try again.'
        : temporarilyUnavailable
          ? 'The AI service is temporarily busy. Please try again shortly.'
          : 'The AI service could not answer right now. Please try again.'
      const statusCode = timedOut ? 504 : temporarilyUnavailable ? 503 : 502

      if (response.headersSent) {
        response.write(`${JSON.stringify({ type: 'error', error: errorMessage })}\n`)
        response.end()
      } else {
        sendJson(response, statusCode, { error: errorMessage })
      }
    }
  } catch (error) {
    sendJson(response, error.statusCode ?? 500, {
      error: error.statusCode ? error.message : 'The request could not be processed.',
    })
  }
})

const port = Number(process.env.API_PORT || 3001)
server.listen(port, '127.0.0.1', () => {
  console.log(`Chat API server listening on http://127.0.0.1:${port}`)
})
