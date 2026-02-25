import { useQuery } from '@tanstack/react-query'
import { AppShell } from '../components/common/AppShell'
import { useSessionRequired } from '../hooks/useSessionRequired'
import { useDataService } from '../hooks/useService'
import { useAppStore } from '../app/store'

export function DashboardPage() {
  const session = useSessionRequired()
  const service = useDataService()
  const includeTest = useAppStore((s) => s.includeTestUserData)
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', includeTest],
    queryFn: () => service.getDashboardData(includeTest),
    enabled: Boolean(session),
  })

  if (!session) return null

  return (
    <AppShell title="进度统计面板">
      {isLoading && <div>加载统计中...</div>}
      {error && <div className="error-msg">{String(error)}</div>}
      {data && (
        <>
          <section className="panel">
            <h2>任务目标总览</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>task_name</th>
                    <th>total_items</th>
                    <th>target_total_completed</th>
                    <th>completed_total(double)</th>
                    <th>completion_rate</th>
                    <th>is_target_met</th>
                    <th>single_only_count</th>
                    <th>zero_annotated_count</th>
                    <th>remaining_to_double_target</th>
                    <th>needs_adjudication_count</th>
                    <th>coverage_status_json</th>
                  </tr>
                </thead>
                <tbody>
                  {data.taskProgress.map((p) => (
                    <tr key={p.taskType}>
                      <td>{p.taskType}</td>
                      <td>{p.totalItems}</td>
                      <td>{p.targetTotalCompleted}</td>
                      <td>{p.doubleAnnotatedCount}</td>
                      <td>{(p.completionRate * 100).toFixed(1)}%</td>
                      <td>{String(p.isTargetMet)}</td>
                      <td>{p.singleOnlyCount}</td>
                      <td>{p.zeroAnnotatedCount}</td>
                      <td>{p.remainingToDoubleTarget}</td>
                      <td>{p.needsAdjudicationCount}</td>
                      <td>
                        <code className="code-cell">{JSON.stringify((p.coverageStatus ?? []).map((c) => ({ label_name: c.labelName, adjudicated_count: c.adjudicatedCount, target_min_per_label: c.targetMinPerLabel, is_label_target_met: c.isLabelTargetMet })))}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h2>组员进度总览</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>user_name</th>
                    <th>role</th>
                    <th>completed_total</th>
                    <th>ai_sentence_completed</th>
                    <th>role_completed</th>
                    <th>boundary_completed</th>
                    <th>initiation_completed</th>
                    <th>adjudication_completed_count</th>
                    <th>last_activity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.userProgress.map((r) => (
                    <tr key={r.userName}>
                      <td>{r.userName}</td>
                      <td>{r.role}</td>
                      <td>{r.completedTotal}</td>
                      <td>{r.aiSentenceCompleted}</td>
                      <td>{r.roleCompleted}</td>
                      <td>{r.boundaryCompleted}</td>
                      <td>{r.initiationCompleted}</td>
                      <td>{r.adjudicationCompletedCount}</td>
                      <td>{r.lastActivityAt ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AppShell>
  )
}
