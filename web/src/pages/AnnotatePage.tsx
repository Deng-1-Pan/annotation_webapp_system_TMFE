import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { AppShell } from '../components/common/AppShell'
import { TaskTutorial } from '../components/common/TaskTutorial'
import { TaskItemAnnotator } from '../components/task/TaskItemAnnotator'
import { useSessionRequired } from '../hooks/useSessionRequired'
import { useDataService } from '../hooks/useService'
import { isTaskType } from '../lib/taskMeta'
import type { AnnotationInput } from '../types/schema'

export function AnnotatePage() {
  const session = useSessionRequired()
  const service = useDataService()
  const queryClient = useQueryClient()
  const { taskType, batchId } = useParams()
  const [index, setIndex] = useState(0)

  const validTaskType = isTaskType(taskType) ? taskType : null
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['batch', session, validTaskType, batchId],
    queryFn: () => {
      if (!session || !validTaskType || !batchId) throw new Error('Invalid route')
      return service.getBatch({ session, taskType: validTaskType, batchId })
    },
    enabled: Boolean(session && validTaskType && batchId),
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: { sampleId: string; annotation: AnnotationInput }) => {
      if (!session || !validTaskType || !batchId) throw new Error('Invalid route')
      await service.saveAnnotation({
        session,
        taskType: validTaskType,
        sampleId: payload.sampleId,
        batchId,
        annotation: payload.annotation,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lobby'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['batch', session, validTaskType, batchId] }),
      ])
    },
  })

  const currentItem = useMemo(() => data?.items[index], [data, index])

  useEffect(() => {
    setIndex(0)
  }, [batchId, validTaskType])

  if (!session) return null
  if (!validTaskType || !batchId) return <AppShell title="标注"><div className="error-msg">路由参数无效</div></AppShell>

  return (
    <AppShell title={`标注页面 · ${validTaskType}`}>
      {isLoading && <div>加载批次中...</div>}
      {error && <div className="error-msg">{String(error)}</div>}
      {data && (
        <>
          <section className="panel">
            <div className="panel-header">
              <h2>批次 {data.batchId}</h2>
              <button className="btn btn-secondary" onClick={() => void refetch()}>刷新</button>
            </div>
            <TaskTutorial taskType={validTaskType} />
            <div className="progress-stack">
              <div className="progress-label">当前批次进度 {Math.min(index, data.items.length)}/{data.items.length}</div>
              <div className="progress-bar"><div style={{ width: `${data.items.length ? (index / data.items.length) * 100 : 0}%` }} /></div>
            </div>
          </section>

          {!currentItem ? (
            <section className="panel">
              <h3>当前批次已完成</h3>
              <p>可以返回任务大厅继续领取下一批。</p>
              <div className="toolbar-row" style={{ marginTop: '0.6rem' }}>
                <Link className="btn" to="/lobby">返回任务大厅</Link>
                <Link className="btn btn-secondary" to={`/claim/${validTaskType}`}>继续领取该任务批次</Link>
              </div>
            </section>
          ) : (
            <TaskItemAnnotator
              taskType={validTaskType}
              item={currentItem}
              index={index}
              total={data.items.length}
              onSubmit={async (annotation, saveAndNext) => {
                await saveMutation.mutateAsync({ sampleId: currentItem.taskItem.sampleId, annotation })
                if (saveAndNext) setIndex((i) => Math.min(i + 1, data.items.length))
              }}
            />
          )}
        </>
      )}
    </AppShell>
  )
}
