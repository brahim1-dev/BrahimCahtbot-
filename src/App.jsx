
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

const App = () => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')

  const sendMessage = async (event) => {
    event.preventDefault()
    const message = input.trim()

    if (!message || isSending) return

    const nextMessages = [...messages, { role: 'user', content: message }]
    const assistantIndex = nextMessages.length
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setInput('')
    setError('')
    setIsSending(true)
    const requestController = new AbortController()
    const requestTimeout = window.setTimeout(() => requestController.abort(), 55000)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
        signal: requestController.signal,
      })
      if (!response.ok) {
        const responseBody = await response.text()
        let result
        try {
          result = JSON.parse(responseBody)
        } catch {
          throw new Error('The chat API returned an invalid response. Check that the API server is running.')
        }
        throw new Error(result.error || 'The message could not be sent.')
      }

      if (!response.body) {
        throw new Error('The chat API does not support streamed responses. Restart the API server and try again.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let bufferedText = ''
      let receivedDone = false
      let receivedText = false

      const processLine = (line) => {
        if (!line.trim()) return

        let event
        try {
          event = JSON.parse(line)
        } catch {
          throw new Error('The chat API sent an invalid stream response.')
        }

        if (event.type === 'delta' && typeof event.text === 'string') {
          receivedText ||= Boolean(event.text)
          setMessages((currentMessages) => {
            const updatedMessages = [...currentMessages]
            const assistantMessage = updatedMessages[assistantIndex]
            updatedMessages[assistantIndex] = {
              ...assistantMessage,
              content: assistantMessage.content + event.text,
            }
            return updatedMessages
          })
        } else if (event.type === 'done') {
          receivedDone = true
        } else if (event.type === 'error') {
          throw new Error(event.error || 'The AI service could not answer right now.')
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        bufferedText += decoder.decode(value, { stream: !done })
        const lines = bufferedText.split('\n')
        bufferedText = lines.pop() ?? ''
        lines.forEach(processLine)

        if (done) break
      }

      if (bufferedText.trim()) processLine(bufferedText)
      if (!receivedText || !receivedDone) {
        throw new Error('The response stream ended before the answer was complete.')
      }
    } catch (requestError) {
      setMessages((currentMessages) =>
        currentMessages.filter((item, index) => index !== assistantIndex || item.content),
      )
      setError(
        requestError.name === 'AbortError'
          ? 'The AI service is taking too long to respond. Please try again.'
          : requestError instanceof TypeError
            ? 'Could not reach the chat API. Start it with `npm run server` and check that GEMINI_API_KEY is set in `.env.local`.'
            : requestError.message || 'Could not reach the AI service. Please try again.',
      )
    } finally {
      window.clearTimeout(requestTimeout)
      setIsSending(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1 className="title">Brahim ChatBot</h1>
      </header>

      <main className="chat-panel" aria-live="polite">
        <div className="chat-content">
          {messages.length === 0 ? (
            <p className="empty-state">Hello! What would you like to talk about?</p>
          ) : (
            <div className="message-list">
              {messages.map((item, index) => (
                <div className={`message-row ${item.role}`} key={`${index}-${item.role}`}>
                  <div className="chat-message">
                    {item.role === 'assistant' ? (
                      <ReactMarkdown>{item.content}</ReactMarkdown>
                    ) : (
                      item.content
                    )}
                  </div>
                </div>
              ))}
              {isSending && <p className="status-message">Thinking...</p>}
            </div>
          )}
        </div>
      </main>

      <form className="composer" onSubmit={sendMessage}>
        <input
          type="text"
          className="message-input"
          placeholder="Type your message here..."
          aria-label="Type your message"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={isSending}
        />

        <button
          className="send-button"
          type="submit"
          aria-label="Send message"
          disabled={isSending || !input.trim()}
        >
          <span className="send-icon" aria-hidden="true">➤</span>
        </button>
      </form>
      {error && <p className="error-message" role="alert">{error}</p>}
    </div>
  )
}

export default App