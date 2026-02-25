import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/common/AppShell'
import { AdjudicationEditor } from '../components/adjudication/AdjudicationEditor'
import { useSessionRequired } from '../hooks/useSessionRequired'
import { useDataService } from '../hooks/useService'
import { findNextAdjudicationCandidate } from '../lib/progress'
import { isTaskType } from '../lib/taskMeta'

export function AdjudicationDetailPage() {
  const session = useSessionRequired()
  const service = useDataService()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { taskType, sampleId } = useParams()
  const validTaskType = isTaskType(taskType) ? taskType : null

  const detailQuery = useQuery({
    queryKey: ['adjudication-detail', validTaskType, sampleId],
    queryFn: () => {
      if (!validTaskType || !sampleId) throw new Error('Invalid route')
      return service.getAdjudicationDetail(validTaskType, sampleId)
    },
    enabled: Boolean(session?.mode === 'adjudicator' && validTaskType && sampleId),
  })

  const queueQuery = useQuery({
    queryKey: ['adjudication-queue'],
    queryFn: () => service.listAdjudicationQueue({}),
    enabled: Boolean(session?.mode === 'adjudicator'),
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: { adjudicated: Record<string, unknown>; notes?: string; saveNext: boolean }) => {
      if (!session || !validTaskType || !sampleId) throw new Error('Invalid route')
      await service.saveAdjudication({
        session,
        taskType: validTaskType,
        sampleId,
        adjudicated: payload.adjudicated,
        notes: payload.notes,
      })
      return payload
    },
    onSuccess: async (payload) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['adjudication-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['adjudication-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['lobby'] }),
      ])
      if (payload.saveNext && validTaskType && sampleId && queueQuery.data) {
        const next = findNextAdjudicationCandidate(queueQuery.data, { taskType: validTaskType, sampleId })
        if (next) navigate(`/adjudication/${next.taskType}/${next.sampleId}`)
      }
    },
  })

  if (!session) return null
  if (session.mode !== 'adjudicator') {
    return <AppShell title="仲裁"><div className="error-msg">无权限</div></AppShell>
  }
  if (!validTaskType || !sampleId) {
    return <AppShell title="仲裁详情"><div className="error-msg">无效参数</div></AppShell>
  }

  return (
    <AppShell title={`仲裁详情 · ${validTaskType}`}>
      {detailQuery.isLoading && <div>加载中...</div>}
      {detailQuery.error && <div className="error-msg">{String(detailQuery.error)}</div>}
      {detailQuery.data && (
        <AdjudicationEditor
          detail={detailQuery.data}
          onSave={async (payload, saveNext) => {
            await saveMutation.mutateAsync({ ...payload, saveNext })
          }}
        />
      )}
    </AppShell>
  )
}
