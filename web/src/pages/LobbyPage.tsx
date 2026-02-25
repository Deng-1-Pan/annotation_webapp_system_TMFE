import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/common/AppShell'
import { StatPill } from '../components/common/StatPill'
import { TaskTutorial } from '../components/common/TaskTutorial'
import { useSessionRequired } from '../hooks/useSessionRequired'
import { useDataService } from '../hooks/useService'
import { useAppStore } from '../app/store'

export function LobbyPage() {
  const session = useSessionRequired()
  const service = useDataService()
  const includeTest = useAppStore((s) => s.includeTestUserData)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['lobby', session, includeTest],
    queryFn: () => service.getLobbyData(session!, includeTest),
    enabled: Boolean(session),
  })

  if (!session) return null

  return (
    <AppShell title="任务大厅">
      {isLoading && <div>加载中...</div>}
      {error && <div className="error-msg">{String(error)}</div>}
      {data && (
        <>
          <section className="grid two-col">
            <div className="panel">
              <div className="panel-header">
                <h2>当前会话</h2>
                <button className="btn btn-secondary" onClick={() => void refetch()}>刷新</button>
              </div>
              <div className="field-grid compact-grid">
                <div className="field-block"><label>姓名</label><div className="field-value">{data.currentUser.displayName}</div></div>
                <div className="field-block"><label>模式</label><div className="field-value">{data.mode}</div></div>
                <div className="field-block"><label>is_test_user</label><div className="field-value">{String(data.currentUser.isTestUser)}</div></div>
                <div className="field-block"><label>正式进度默认排除测试</label><div className="field-value">是（可切换）</div></div>
              </div>
            </div>

            <div className="panel">
              <h2>个人进度概览</h2>
              {(() => {
                const targetUserRow = data.userProgress.find((r) => r.userName === data.currentUser.displayName) ??
                  data.userProgress.find((r) => r.userName.startsWith(data.currentUser.displayName))
                if (!targetUserRow) return <div className="muted-text">暂无提交</div>
                return (
                  <div className="pill-row wrap">
                    <StatPill label="总提交" value={targetUserRow.completedTotal} />
                    <StatPill label="AI句子" value={targetUserRow.aiSentenceCompleted} />
                    <StatPill label="角色" value={targetUserRow.roleCompleted} />
                    <StatPill label="边界" value={targetUserRow.boundaryCompleted} />
                    <StatPill label="initiation" value={targetUserRow.initiationCompleted} />
                    <StatPill label="仲裁完成" value={targetUserRow.adjudicationCompletedCount} />
                  </div>
                )
              })()}
            </div>
          </section>

          <section className="grid two-col">
            {data.taskProgress.map((p) => {
              const cfg = data.taskConfigs.find((c) => c.taskType === p.taskType)
              if (!cfg) return null
              return (
                <article key={p.taskType} className="panel task-card">
                  <div className="panel-header">
                    <h2>{cfg.displayName}</h2>
                    <span className={`status-badge ${p.isTargetMet ? 'adjudicated' : 'double_annotated_no_conflict'}`}>
                      {p.isTargetMet ? '达标' : '未达标'}
                    </span>
                  </div>
                  <p>{cfg.description}</p>
                  <div className="progress-stack">
                    <div className="progress-label">任务双标进度 {p.doubleAnnotatedCount}/{cfg.targetTotalCompleted}</div>
                    <div className="progress-bar"><div style={{ width: `${Math.min(100, p.completionRate * 100)}%` }} /></div>
                  </div>
                  <div className="pill-row wrap">
                    <StatPill label="总条数" value={p.totalItems} />
                    <StatPill label="single" value={p.singleAnnotatedCount} />
                    <StatPill label="double" value={p.doubleAnnotatedCount} tone="good" />
                    <StatPill label="adjudicated" value={p.adjudicatedCount} />
                    <StatPill label="single_only" value={p.singleOnlyCount} tone="warn" />
                    <StatPill label="zero" value={p.zeroAnnotatedCount} />
                    <StatPill label="in_progress" value={p.inProgressCount} />
                    <StatPill label="needs_adj" value={p.needsAdjudicationCount} tone="danger" />
                    <StatPill label="remaining_to_double_target" value={p.remainingToDoubleTarget} tone="warn" />
                  </div>
                  {p.coverageStatus && (
                    <div className="coverage-box">
                      {p.coverageStatus.map((c) => (
                        <div key={c.labelName} className="coverage-row">
                          <span>{c.labelName}</span>
                          <strong>{c.adjudicatedCount}/{c.targetMinPerLabel}</strong>
                          <span className={c.isLabelTargetMet ? 'ok' : 'bad'}>{c.isLabelTargetMet ? '达标' : '未达标'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <TaskTutorial taskType={p.taskType} />
                  <div className="toolbar-row">
                    <Link className="btn" to={`/claim/${p.taskType}`}>领取批次</Link>
                    <Link className="btn btn-secondary" to="/dashboard">看统计</Link>
                  </div>
                </article>
              )
            })}
          </section>

          {session.mode === 'adjudicator' && (
            <section className="panel">
              <h2>仲裁入口</h2>
              <div className="toolbar-row">
                <Link className="btn btn-primary" to="/adjudication">进入仲裁页面</Link>
              </div>
            </section>
          )}
        </>
      )}
    </AppShell>
  )
}
