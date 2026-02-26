import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/common/AppShell'
import { TaskTutorial } from '../components/common/TaskTutorial'
import { useSessionRequired } from '../hooks/useSessionRequired'
import { useDataService } from '../hooks/useService'
import { useAppStore } from '../app/store'
import { isTaskType } from '../lib/taskMeta'

export function ClaimPage() {
  const session = useSessionRequired()
  const service = useDataService()
  const navigate = useNavigate()
  const setCurrentBatchId = useAppStore((s) => s.setCurrentBatchId)
  const includeTestUserData = useAppStore((s) => s.includeTestUserData)
  const params = useParams()
  const taskType = params.taskType
  const [batchSize, setBatchSize] = useState(10)
  const [claimedPreview, setClaimedPreview] = useState<{ toDoubleCount: number; newItemCount: number } | null>(null)
  const [claimInfo, setClaimInfo] = useState<string | null>(null)
  const claimingRef = useRef(false)

  const validTaskType = taskType && isTaskType(taskType) ? taskType : null
  const taskProgressQuery = useQuery({
    queryKey: ['claim-task-progress', validTaskType],
    queryFn: async () => {
      const dashboard = await service.getDashboardData(false)
      return dashboard.taskProgress.find((p) => p.taskType === validTaskType) ?? null
    },
    enabled: Boolean(session && validTaskType),
  })
  const remainingAssignableCount =
    taskProgressQuery.data == null
      ? null
      : taskProgressQuery.data.singleOnlyCount + taskProgressQuery.data.zeroAnnotatedCount
  const effectiveRequestedBatchSize =
    remainingAssignableCount == null ? batchSize : Math.min(batchSize, Math.max(0, remainingAssignableCount))

  const claimMutation = useMutation({
    mutationFn: async () => {
      if (claimingRef.current) throw new Error('请勿重复点击')
      claimingRef.current = true
      if (!session || !validTaskType) throw new Error('Invalid task')
      if (effectiveRequestedBatchSize <= 0) {
        throw new Error('当前任务没有可分配的剩余样本')
      }
      return {
        requestedBatchSize: batchSize,
        effectiveRequestedBatchSize,
        result: await service.claimBatch({ session, taskType: validTaskType, batchSize: effectiveRequestedBatchSize }),
      }
    },
    onSettled: () => { claimingRef.current = false },
    onSuccess: ({ result, requestedBatchSize, effectiveRequestedBatchSize }) => {
      setCurrentBatchId(result.taskType, result.batchId)
      setClaimedPreview({ toDoubleCount: result.toDoubleCount, newItemCount: result.newItemCount })
      const assignedCount = result.sampleIds.length
      if (assignedCount === 0) {
        setClaimInfo('当前没有可分配样本（可能已完成、已被你标注过，或被其他人临时领取）。请稍后重试或切换任务。')
        return
      }
      if (effectiveRequestedBatchSize < requestedBatchSize) {
        setClaimInfo(`你选择了 ${requestedBatchSize} 条，但当前任务剩余可分配样本约 ${effectiveRequestedBatchSize} 条，已按剩余数量分配。`)
      } else if (assignedCount < effectiveRequestedBatchSize) {
        setClaimInfo(`请求 ${effectiveRequestedBatchSize} 条，实际分配 ${assignedCount} 条（可能因你已标过或有进行中 claim）。`)
      } else {
        setClaimInfo(`已成功分配 ${assignedCount} 条。`)
      }
      navigate(`/annotate/${result.taskType}/${result.batchId}`)
    },
  })

  if (!session) return null
  if (!validTaskType) {
    return <AppShell title="批次领取"><div className="error-msg">未知任务类型</div></AppShell>
  }

  return (
    <AppShell title="批次领取">
      <section className="panel max-w-panel">
        <h2>{validTaskType}</h2>
        <p>领取范围 5-20 条。分配策略：优先补齐 single_only，再用 zero_annotated 补足（auto_mixed）。</p>
        <TaskTutorial taskType={validTaskType} />
        {taskProgressQuery.data && (
          <div className="muted-text">
            当前任务剩余可分配样本（single_only + zero，未双标口径）：{remainingAssignableCount}
            {includeTestUserData ? '（提示按正式口径计算，不包含 test 影响）' : ''}
          </div>
        )}
        <label className="form-control">
          <span>批次大小：{batchSize}</span>
          <input type="range" min={5} max={20} value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} />
        </label>
        {remainingAssignableCount !== null && remainingAssignableCount < batchSize && (
          <div className="muted-text">
            你选择了 {batchSize} 条，但当前剩余可分配样本约 {Math.max(0, remainingAssignableCount)} 条，将按剩余数量领取。
          </div>
        )}
        <div className="toolbar-row">
          <button
            className="btn btn-primary"
            disabled={
              claimMutation.isPending ||
              session.mode === 'adjudicator' ||
              (remainingAssignableCount !== null && remainingAssignableCount <= 0)
            }
            onClick={() => {
              setClaimInfo(null)
              claimMutation.mutate()
            }}
          >
            {claimMutation.isPending ? '领取中...' : '确认领取'}
          </button>
        </div>
        {session.mode === 'adjudicator' && <div className="muted-text">仲裁模式不可领取普通标注批次。</div>}
        {claimMutation.error && <div className="error-msg">{String(claimMutation.error)}</div>}
        {claimInfo && <div className="muted-text">{claimInfo}</div>}
        {claimedPreview && (
          <div className="pill-row">
            <div className="stat-pill"><span>assigned_count</span><strong>{claimedPreview.toDoubleCount + claimedPreview.newItemCount}</strong></div>
            <div className="stat-pill"><span>to_double_count</span><strong>{claimedPreview.toDoubleCount}</strong></div>
            <div className="stat-pill"><span>new_item_count</span><strong>{claimedPreview.newItemCount}</strong></div>
          </div>
        )}
      </section>
    </AppShell>
  )
}
