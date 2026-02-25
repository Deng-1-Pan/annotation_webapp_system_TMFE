import { Link } from 'react-router-dom'
import { AppShell } from '../components/common/AppShell'

export function ForbiddenPage() {
  return (
    <AppShell title="无权限访问">
      <section className="panel max-w-panel">
        <p>你当前会话没有权限访问该页面。</p>
        <Link className="btn" to="/lobby">返回任务大厅</Link>
      </section>
    </AppShell>
  )
}
