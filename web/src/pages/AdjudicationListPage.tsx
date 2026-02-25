import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/common/AppShell'
import { useSessionRequired } from '../hooks/useSessionRequired'
import { useDataService } from '../hooks/useService'
import type { TaskType } from '../types/schema'

export function AdjudicationListPage() {
  const session = useSessionRequired()
  const service = useDataService()
  const queryClient = useQueryClient()
  const [taskType, setTaskType] = useState<TaskType | 'all'>('all')
  const [onlyConflicts, setOnlyConflicts] = useState(false)

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['adjudication-queue', taskType, onlyConflicts],
    queryFn: () =>
      service.listAdjudicationQueue({
        taskType: taskType === 'all' ? undefined : taskType,
        onlyConflicts,
      }),
    enabled: Boolean(session?.mode === 'adjudicator'),
  })

  const autoFillMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('No session')
      return service.autoFillMatchingAdjudications(session)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['adjudication-queue'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  if (!session) return null
  if (session.mode !== 'adjudicator') {
    return <AppShell title="仲裁"><div className="error-msg">仅 Deng Pan 的 adjudicator 模式可访问。</div></AppShell>
  }

  return (
    <AppShell title="仲裁队列">
      <section className="panel">
        <div className="toolbar-row wrap">
          <label className="form-control inline">
            <span>任务类型</span>
            <select value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType | 'all')}>
              <option value="all">全部</option>
              <option value="ai_sentence_audit">ai_sentence_audit</option>
              <option value="role_audit_qa_turns">role_audit_qa_turns</option>
              <option value="qa_boundary_audit_docs">qa_boundary_audit_docs</option>
              <option value="initiation_audit_exchanges">initiation_audit_exchanges</option>
            </select>
          </label>
          <label className="toggle-inline">
            <input type="checkbox" checked={onlyConflicts} onChange={(e) => setOnlyConflicts(e.target.checked)} />
            仅显示冲突样本
          </label>
          <button className="btn btn-secondary" onClick={() => autoFillMutation.mutate()} disabled={autoFillMutation.isPending}>
            一键自动填充一致样本
          </button>
          {autoFillMutation.data && <span className="muted-text">已更新 {autoFillMutation.data.updatedCount} 条</span>}
        </div>
      </section>

      <section className="panel">
        <h2>待仲裁列表（{data.length}）</h2>
        {isLoading && <div>加载中...</div>}
        {error && <div className="error-msg">{String(error)}</div>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>sample_id</th>
                <th>task_type</th>
                <th>doc_id</th>
                <th>status</th>
                <th>updated_at</th>
                <th>action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={`${row.taskType}-${row.sampleId}`}>
                  <td>{row.sampleId}</td>
                  <td>{row.taskType}</td>
                  <td>{row.docId}</td>
                  <td>{row.status}</td>
                  <td>{row.updatedAt}</td>
                  <td>
                    <Link className="btn" to={`/adjudication/${row.taskType}/${row.sampleId}`}>进入</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  )
}
