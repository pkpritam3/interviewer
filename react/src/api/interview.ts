import axios from 'axios'
import type { InterviewQuestion } from './questions'

export type StartInterviewResponse = {
  sessionId: string
  questions: InterviewQuestion[]
  reply?: string
}

export async function startInterview() {
  try {
    const { data } = await axios.post<StartInterviewResponse>('/api/interview')
    return data
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      typeof error.response?.data?.sessionId === 'string'
    ) {
      return error.response.data as StartInterviewResponse
    }

    throw error
  }
}

let inFlightStart: Promise<StartInterviewResponse> | null = null

export function startInterviewOnce() {
  if (!inFlightStart) {
    inFlightStart = startInterview().catch((error) => {
      inFlightStart = null
      throw error
    })
  }

  return inFlightStart
}

export function resetInterviewStart() {
  inFlightStart = null
}
