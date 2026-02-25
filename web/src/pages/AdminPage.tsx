import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AppShell } from '../components/common/AppShell'
import { useSessionRequired } from '../hooks/useSessionRequired'
import { useDataService } from '../hooks/useService'

export function AdminPage() {
  const session = useSessionRequired()
  const service = useDataService()
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-configs'],
    queryFn: async () => ({
      users: await service.getUsers(),
      taskConfigs: await service.getTaskConfigs(),
    }),
    enabled: Boolean(session),
  })
  const [draftTotals, setDraftTotals] = useState<Record<string, number>>({})

  const saveMutation = useMutation({
    mutationFn: async (taskType: string) => {
      const target = draftTotals[taskType]
      if (target === undefined) return
      await service.updateTaskConfig({ taskType: taskType as never, targetTotalCompleted: target })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-configs'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['lobby'] }),
      ])
    },
  })

  if (!session) return null

  return (
    <AppShell title="管理员配置（轻量）">
      {isLoading && <div>加载中...</div>}
      {error && <div className="error-msg">{String(error)}</div>}
      {data && (
        <>
          <section className="panel">
            <h2>预置用户（固定名单）</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>display_name</th>
                    <th>is_test_user</th>
                    <th>can_adjudicate</th>
                    <th>is_active</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.displayName}</td>
                      <td>{String(u.isTestUser)}</td>
                      <td>{String(u.canAdjudicate)}</td>
                      <td>{String(u.isActive)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h2>任务目标配置</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>task_type</th>
                    <th>target_total_completed</th>
                    <th>target_min_per_label</th>
                    <th>coverage_labels</th>
                    <th>exclude_test_by_default</th>
                    <th>batch_strategy</th>
                    <th>save</th>
                  </tr>
                </thead>
                <tbody>
                  {data.taskConfigs.map((cfg) => (
                    <tr key={cfg.taskType}>
                      <td>{cfg.taskType}</td>
                      <td>
                        <input
                          type="number"
                          value={draftTotals[cfg.taskType] ?? cfg.targetTotalCompleted}
                          onChange={(e) =>
                            setDraftTotals((d) => ({ ...d, [cfg.taskType]: Number(e.target.value) }))
                          }
                          style={{ width: 100 }}
                        />
                      </td>
                      <td>{cfg.targetMinPerLabel ?? '-'}</td>
                      <td><code className="code-cell">{JSON.stringify(cfg.coverageLabels ?? [])}</code></td>
                      <td>{String(cfg.excludeTestByDefault)}</td>
                      <td>{cfg.batchStrategy}</td>
                      <td>
                        <button className="btn" onClick={() => saveMutation.mutate(cfg.taskType)} disabled={saveMutation.isPending}>保存</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {saveMutation.error && <div className="error-msg">{String(saveMutation.error)}</div>}
          </section>
        </>
      )}
    </AppShell>
  )
}
