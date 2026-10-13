export const INTERVIEW_STATES = [
  "INTRO",
  "BRUTE_FORCE",
  "OPTIMISATION",
  "CODE_WRITING",
  "DRYRUN",
  "END",
] as const;

export type InterviewState = (typeof INTERVIEW_STATES)[number];

const sessionStates = new Map<string, InterviewState>();

export function setSessionState(sessionId: string, state: InterviewState) {
  sessionStates.set(sessionId, state);
}

export function getSessionState(sessionId: string) {
  return sessionStates.get(sessionId);
}

export function advanceSessionState(sessionId: string) {
  const currentState = sessionStates.get(sessionId);

  if (!currentState) {
    return { ok: false as const, error: "Session not found" as const, status: 404 };
  }

  if (currentState === "END") {
    return {
      ok: true as const,
      previousState: currentState,
      currentState,
    };
  }

  const currentIndex = INTERVIEW_STATES.indexOf(currentState);
  const nextState = INTERVIEW_STATES[currentIndex + 1] ?? "END";
  sessionStates.set(sessionId, nextState);

  return {
    ok: true as const,
    previousState: currentState,
    currentState: nextState,
  };
}
