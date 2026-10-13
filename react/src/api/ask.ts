import axios from 'axios'

export async function ask(
  payload: { query: string; code: string; problem: string },
  sessionId: string,
) {
  const { data } = await axios.post('/api/ask', payload, {
    headers: { sessionId },
  })
  return data
}
