import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDataService } from '../hooks/useService'
import { useAppStore } from '../app/store'
import type { SessionSelection } from '../types/schema'

export function LoginPage() {
  const service = useDataService()
  const navigate = useNavigate()
  const setSession = useAppStore((s) => s.setSession)
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => service.getUsers(),
  })

  const [userId, setUserId] = useState('')
  const selectedUser = users.find((u) => u.id === userId)
  const [dengMode, setDengMode] = useState<'test' | 'adjudicator'>('test')

  function handleEnter() {
    if (!userId) return
    const session: SessionSelection = {
      userId,
      mode: userId === 'deng-pan' ? dengMode : 'annotator',
    }
    setSession(session)
    navigate('/lobby')
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>TMFE 多人协作人工标注系统</h1>
        <p>固定名单登录，支持批次领取、双标进度、仲裁与 CSV 导出。</p>
        {isLoading && <div>加载用户中...</div>}
        {error && <div className="error-msg">{String(error)}</div>}
        <label className="form-control">
          <span>选择你的姓名（固定名单）</span>
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">-- 请选择 --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}{u.isTestUser ? ' (test user)' : ''}
              </option>
            ))}
          </select>
        </label>

        {selectedUser?.id === 'deng-pan' && (
          <label className="form-control">
            <span>Deng Pan 进入模式</span>
            <select value={dengMode} onChange={(e) => setDengMode(e.target.value as 'test' | 'adjudicator')}>
              <option value="test">测试模式（test）</option>
              <option value="adjudicator">仲裁模式（adjudicator）</option>
            </select>
          </label>
        )}

        <button className="btn btn-primary btn-block" disabled={!userId} onClick={handleEnter}>
          进入系统
        </button>

        <div className="muted-text small">
          说明：正式共享进度需使用 Supabase 模式；本地默认 mock 模式用于演示与联调。
        </div>
      </div>
    </div>
  )
}
