import { useEffect, useRef, useState } from 'react'
import { ask } from '../api/ask'
import { resetInterviewStart, startInterviewOnce } from '../api/interview'
import type { InterviewQuestion } from '../api/questions'
import { extractSpeechText, speak, stopSpeaking } from '../speak'
import { getSpeechRecognitionCtor } from '../speechRecognition'

const INTERVIEW_DURATION_SECONDS = 30 * 60

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function InterviewPage() {
  const [question, setQuestion] = useState<InterviewQuestion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [answer, setAnswer] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(INTERVIEW_DURATION_SECONDS)
  const [ended, setEnded] = useState(false)
  const [leftPercent, setLeftPercent] = useState(50)
  const [dragging, setDragging] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const splitRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const transcriptRef = useRef('')
  const answerRef = useRef(answer)
  const questionRef = useRef<InterviewQuestion | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const isListeningRef = useRef(false)

  answerRef.current = answer
  questionRef.current = question
  sessionIdRef.current = sessionId

  const MIN_PANE_PERCENT = 20
  const MAX_PANE_PERCENT = 80

  function setSplitFromClientX(clientX: number) {
    const split = splitRef.current
    if (!split) {
      return
    }

    const { left, width } = split.getBoundingClientRect()
    if (width === 0) {
      return
    }

    const next = ((clientX - left) / width) * 100
    setLeftPercent(Math.min(MAX_PANE_PERCENT, Math.max(MIN_PANE_PERCENT, next)))
  }

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)
    setQuestion(null)
    setSessionId(null)

    startInterviewOnce()
      .then((data) => {
        if (cancelled) {
          return
        }

        setSessionId(data.sessionId)
        setQuestion(data.questions[0] ?? null)

        const text = extractSpeechText(data)
        if (text) {
          speak(text)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not start the interview.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      window.setTimeout(() => {
        resetInterviewStart()
      }, 0)
    }
  }, [])

  useEffect(() => {
    if (ended) {
      return
    }

    const intervalId = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [ended])

  useEffect(() => {
    if (secondsLeft === 0) {
      setEnded(true)
    }
  }, [secondsLeft])

  useEffect(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor()
    if (!SpeechRecognitionCtor) {
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]
        const piece = result?.[0]?.transcript ?? ''

        if (result?.isFinal) {
          finalText += piece
        } else {
          interimText += piece
        }
      }

      transcriptRef.current = `${finalText} ${interimText}`.trim()
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') {
        return
      }

      isListeningRef.current = false
      setIsListening(false)
      setSpeechError('Could not capture speech. Check microphone permission.')
    }

    recognition.onend = () => {
      if (!isListeningRef.current) {
        return
      }

      try {
        recognition.start()
      } catch {
        // Already running.
      }
    }

    recognitionRef.current = recognition

    return () => {
      isListeningRef.current = false
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.stop()
      } catch {
        // Recognition was not started.
      }
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!ended || !isListening) {
      return
    }

    isListeningRef.current = false
    stopSpeaking()
    try {
      recognitionRef.current?.stop()
    } catch {
      // Recognition was not started.
    }
  }, [ended, isListening])

  function sendAsk(query: string) {
    const currentSessionId = sessionIdRef.current
    if (!currentSessionId) {
      setSpeechError('Interview session is not ready.')
      return
    }

    void ask(
      {
        query,
        code: answerRef.current,
        problem: questionRef.current?.problem ?? '',
      },
      currentSessionId,
    )
      .then((data) => {
        const text = extractSpeechText(data)
        if (!text) {
          setSpeechError('Ask returned no spoken response.')
          return
        }

        speak(text)
      })
      .catch(() => {
        setSpeechError('Could not send the question.')
      })
  }

  function handleVoiceButtonClick() {
    const recognition = recognitionRef.current

    if (!recognition) {
      setSpeechError('Speech recognition is not supported in this browser.')
      return
    }

    if (!isListeningRef.current) {
      stopSpeaking()
      setSpeechError(null)
      transcriptRef.current = ''
      isListeningRef.current = true
      setIsListening(true)

      try {
        recognition.start()
      } catch {
        isListeningRef.current = false
        setIsListening(false)
        setSpeechError('Could not start recording.')
      }

      return
    }

    isListeningRef.current = false
    setIsListening(false)
    sendAsk(transcriptRef.current.trim())

    try {
      recognition.stop()
    } catch {
      // Recognition was not started.
    }
  }

  const timerLow = secondsLeft <= 5 * 60

  return (
    <div className="relative flex min-h-svh flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-semibold tracking-tight">DSA Interview</h1>
        <p
          className={`font-mono text-xl tabular-nums ${timerLow ? 'text-red-600' : 'text-slate-800'}`}
          aria-live="polite"
        >
          {formatTime(secondsLeft)}
        </p>
        <button
          type="button"
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={ended}
          onClick={() => setEnded(true)}
        >
          {ended ? 'Interview ended' : 'End interview'}
        </button>
      </header>

      <div
        ref={splitRef}
        className={`flex min-h-0 flex-1 ${dragging ? 'select-none' : ''}`}
      >
        <section
          className="min-w-0 overflow-y-auto bg-white p-6"
          style={{ width: `${leftPercent}%` }}
        >
          {loading && <p className="text-slate-500">Loading question…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {question && (
            <article className="space-y-4 text-left">
              <h2 className="text-2xl font-semibold text-slate-900">
                {question.title}
              </h2>
              <p className="leading-relaxed text-slate-700">{question.problem}</p>
            </article>
          )}
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
          aria-valuemin={MIN_PANE_PERCENT}
          aria-valuemax={MAX_PANE_PERCENT}
          aria-valuenow={Math.round(leftPercent)}
          tabIndex={0}
          className={`w-1.5 shrink-0 cursor-col-resize bg-slate-200 hover:bg-indigo-400 ${dragging ? 'bg-indigo-500' : ''}`}
          onPointerDown={(event) => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            setDragging(true)
            setSplitFromClientX(event.clientX)
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
              return
            }

            setSplitFromClientX(event.clientX)
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId)
            setDragging(false)
          }}
          onPointerCancel={() => setDragging(false)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault()
              setLeftPercent((current) => Math.max(MIN_PANE_PERCENT, current - 2))
            }

            if (event.key === 'ArrowRight') {
              event.preventDefault()
              setLeftPercent((current) => Math.min(MAX_PANE_PERCENT, current + 2))
            }
          }}
        >
          <span className="sr-only">Resize panels</span>
        </div>

        <section className="flex min-w-0 flex-1 flex-col bg-slate-900 p-4 pb-24">
          <label htmlFor="answer-editor" className="sr-only">
            Answer editor
          </label>
          <textarea
            id="answer-editor"
            className="h-full w-full resize-none rounded-md border border-slate-700 bg-slate-950 p-4 font-mono text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400"
            placeholder="Write your solution here…"
            value={answer}
            disabled={ended}
            onChange={(event) => setAnswer(event.target.value)}
          />
        </section>
      </div>

      {speechError && (
        <p className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-md bg-red-50 px-3 py-1 text-sm text-red-700">
          {speechError}
        </p>
      )}

      <button
        type="button"
        aria-label={isListening ? 'Send' : 'Record'}
        className={`absolute bottom-6 left-1/2 z-10 flex size-14 -translate-x-1/2 items-center justify-center rounded-full text-white shadow-lg disabled:cursor-not-allowed disabled:bg-slate-500 disabled:shadow-none ${
          isListening
            ? 'bg-red-500 shadow-red-500/30 hover:bg-red-400'
            : 'bg-indigo-500 shadow-indigo-500/30 hover:bg-indigo-400'
        }`}
        disabled={ended || !question || !sessionId}
        onClick={handleVoiceButtonClick}
      >
        {isListening ? <SendIcon /> : <MicIcon />}
      </button>
    </div>
  )
}

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-6"
      aria-hidden="true"
    >
      <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0z" />
      <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-6"
      aria-hidden="true"
    >
      <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
    </svg>
  )
}

export default InterviewPage
