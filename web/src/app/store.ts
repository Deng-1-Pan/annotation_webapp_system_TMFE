import { create } from 'zustand'
import type { SessionSelection } from '../types/schema'

const SESSION_KEY = 'tmfe-session'
const INCLUDE_TEST_KEY = 'tmfe-include-test-progress'

function loadSession(): SessionSelection | null {
  const raw = localStorage.getItem(SESSION_KEY)
  return raw ? (JSON.parse(raw) as SessionSelection) : null
}

function saveSession(session: SessionSelection | null) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

interface AppUiState {
  session: SessionSelection | null
  includeTestUserData: boolean
  currentBatchByTask: Partial<Record<string, string>>
  setSession: (session: SessionSelection | null) => void
  setIncludeTestUserData: (value: boolean) => void
  setCurrentBatchId: (taskType: string, batchId: string) => void
}

export const useAppStore = create<AppUiState>((set) => ({
  session: loadSession(),
  includeTestUserData: localStorage.getItem(INCLUDE_TEST_KEY) === '1',
  currentBatchByTask: {},
  setSession: (session) => {
    saveSession(session)
    set({ session })
  },
  setIncludeTestUserData: (value) => {
    localStorage.setItem(INCLUDE_TEST_KEY, value ? '1' : '0')
    set({ includeTestUserData: value })
  },
  setCurrentBatchId: (taskType, batchId) =>
    set((state) => ({
      currentBatchByTask: { ...state.currentBatchByTask, [taskType]: batchId },
    })),
}))
