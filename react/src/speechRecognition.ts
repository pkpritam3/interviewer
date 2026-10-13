type SpeechRecognitionCtor = new () => SpeechRecognition

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}
