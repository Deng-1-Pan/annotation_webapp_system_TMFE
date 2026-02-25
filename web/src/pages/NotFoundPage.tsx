import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>404</h1>
        <p>页面不存在</p>
        <Link className="btn btn-primary btn-block" to="/lobby">返回大厅</Link>
      </div>
    </div>
  )
}
