import { Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import InterviewPage from './pages/InterviewPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/interview/:id" element={<InterviewPage />} />
    </Routes>
  )
}

export default App
