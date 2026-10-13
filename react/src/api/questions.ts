import axios from 'axios'

export type InterviewQuestion = {
  id: string
  title: string
  topic: string
  difficulty: string
  problem: string
}

export async function fetchQuestion(id: string) {
  const { data } = await axios.get<InterviewQuestion>(`/api/questions/${id}`)
  return data
}
