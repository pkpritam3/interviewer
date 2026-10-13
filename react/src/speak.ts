export function extractSpeechText(data: unknown): string {
  if (typeof data === 'string') {
    return data.trim()
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return String(data)
  }

  if (Array.isArray(data)) {
    return data.map(extractSpeechText).filter(Boolean).join(' ').trim()
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    const preferredKeys = [
      'output',
      'text',
      'message',
      'response',
      'answer',
      'content',
      'result',
      'reply',
    ]

    for (const key of preferredKeys) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }

    if ('data' in record) {
      const nested = extractSpeechText(record.data)
      if (nested) {
        return nested
      }
    }

    return Object.values(record)
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  return ''
}

export function speak(text: string) {
  if (!text || !('speechSynthesis' in window)) {
    return
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = navigator.language || 'en-US'
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  if (!('speechSynthesis' in window)) {
    return
  }

  window.speechSynthesis.cancel()
}
