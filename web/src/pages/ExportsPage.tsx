import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { AppShell } from '../components/common/AppShell'
import { useSessionRequired } from '../hooks/useSessionRequired'
import { useDataService } from '../hooks/useService'
import { downloadCsv } from '../lib/csv'
import type { ExportRequest, TaskType } from '../types/schema'

export function ExportsPage() {
  const session = useSessionRequired()
  const service = useDataService()
  const [taskType, setTaskType] = useState<TaskType>('ai_sentence_audit')
  const [scope, setScope] = useState<ExportRequest['scope']>('double')
  const [includeTestUserData, setIncludeTestUserData] = useState(false)

  const exportMutation = useMutation({
    mutationFn: () => service.exportCsv({ taskType, scope, includeTestUserData }),
    onSuccess: (result) => {
      downloadCsv(result.filename, result.csvText)
    },
  })

  if (!session) return null

  return (
    <AppShell title="CSV 导出">
      <section className="panel max-w-panel">
        <h2>导出（模板兼容列）</h2>
        <label className="form-control">
          <span>任务</span>
          <select value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)}>
            <option value="ai_sentence_audit">ai_sentence_audit</option>
            <option value="role_audit_qa_turns">role_audit_qa_turns</option>
            <option value="qa_boundary_audit_docs">qa_boundary_audit_docs</option>
            <option value="initiation_audit_exchanges">initiation_audit_exchanges</option>
          </select>
        </label>
        <label className="form-control">
          <span>导出口径</span>
          <select value={scope} onChange={(e) => setScope(e.target.value as ExportRequest['scope'])}>
            <option value="single">single-annotated</option>
            <option value="double">double-annotated</option>
            <option value="adjudicated">adjudicated</option>
            <option value="all_annotations">all-annotations / events</option>
          </select>
        </label>
        <label className="toggle-inline">
          <input type="checkbox" checked={includeTestUserData} onChange={(e) => setIncludeTestUserData(e.target.checked)} />
          包含测试用户数据（默认否）
        </label>

        <div className="toolbar-row">
          <button className="btn btn-primary" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? '导出中...' : '下载 CSV'}
          </button>
        </div>

        {exportMutation.data && (
          <div className="muted-text">已导出 {exportMutation.data.rowCount} 行，文件名：{exportMutation.data.filename}</div>
        )}
        {exportMutation.error && <div className="error-msg">{String(exportMutation.error)}</div>}
      </section>
    </AppShell>
  )
}
