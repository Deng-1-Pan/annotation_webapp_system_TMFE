import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAppStore } from '../../app/store'

interface Props {
  title: string
  children: ReactNode
}

export function AppShell({ title, children }: Props) {
  const session = useAppStore((s) => s.session)
  const setSession = useAppStore((s) => s.setSession)
  const includeTestUserData = useAppStore((s) => s.includeTestUserData)
  const setIncludeTestUserData = useAppStore((s) => s.setIncludeTestUserData)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <Link to="/lobby" className="brand">TMFE Annotation Webapp</Link>
          <div className="subbrand">多人协作人工标注 / 双标进度 + 仲裁 + 导出</div>
        </div>
        <div className="topbar-right">
          {session && (
            <div className="session-chip">
              <span>{session.userId}</span>
              <strong>{session.mode}</strong>
            </div>
          )}
          <label className="toggle-inline">
            <input
              type="checkbox"
              checked={includeTestUserData}
              onChange={(e) => setIncludeTestUserData(e.target.checked)}
            />
            显示测试用户进度
          </label>
          {session && (
            <button className="btn btn-secondary" onClick={() => setSession(null)}>
              退出会话
            </button>
          )}
        </div>
      </header>

      <nav className="nav-strip">
        <NavLink to="/lobby">任务大厅</NavLink>
        <NavLink to="/dashboard">统计面板</NavLink>
        <NavLink to="/exports">导出</NavLink>
        <NavLink to="/admin">配置</NavLink>
        {session?.mode === 'adjudicator' && <NavLink to="/adjudication">仲裁</NavLink>}
      </nav>

      <main className="page-wrap">
        <div className="page-title-row">
          <h1>{title}</h1>
        </div>
        {children}
      </main>
    </div>
  )
}
