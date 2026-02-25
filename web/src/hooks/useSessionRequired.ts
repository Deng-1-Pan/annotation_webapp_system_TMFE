import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAppStore } from '../app/store'

export function useSessionRequired() {
  const session = useAppStore((s) => s.session)
  const navigate = useNavigate()

  useEffect(() => {
    if (!session) navigate('/')
  }, [navigate, session])

  return session
}
