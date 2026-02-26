import { TASK_ORDER } from '../config/defaults'
import { allocateBatch } from './batching'
import { buildDoubleAnnotatedExportRow } from './exportPivot'
import type {
  AdjudicationDetailView,
  AdjudicationQueueRow,
  AdjudicationRecordNormalized,
  AdjudicationStatus,
  AnnotationRecordNormalized,
  AppUser,
  BatchClaimResult,
  BatchItemView,
  CoverageLabelStatus,
  DataStoreSnapshot,
  ExportRequest,
  TaskConfig,
  TaskProgressSummary,
  TaskType,
  TranscriptDocContext,
  UserMode,
  UserProgressRow,
} from '../types/schema'

function isFormalAnnotation(ann: AnnotationRecordNormalized) {
  return ann.mode === 'annotator'
}

function groupBySample<T extends { sampleId: string }>(rows: T[]) {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const list = map.get(row.sampleId) ?? []
    list.push(row)
    map.set(row.sampleId, list)
  }
  return map
}

function stableAnnSort(a: AnnotationRecordNormalized, b: AnnotationRecordNormalized) {
  const byTime = a.submittedAt.localeCompare(b.submittedAt)
  if (byTime !== 0) return byTime
  return a.id.localeCompare(b.id)
}

function getTaskItems(snapshot: DataStoreSnapshot, taskType: TaskType) {
  return snapshot.taskItems.filter((it) => it.taskType === taskType)
}

function getTaskAnnotations(
  snapshot: DataStoreSnapshot,
  taskType: TaskType,
  options?: { includeTestUserData?: boolean },
) {
  const includeTest = options?.includeTestUserData ?? false
  return snapshot.annotations.filter((ann) => {
    if (ann.taskType !== taskType) return false
    if (ann.mode === 'test' && !includeTest) return false
    return true
  })
}

function getFormalTaskAnnotations(snapshot: DataStoreSnapshot, taskType: TaskType) {
  return snapshot.annotations.filter((ann) => ann.taskType === taskType && isFormalAnnotation(ann))
}

function getAdjudicationMap(snapshot: DataStoreSnapshot, taskType: TaskType) {
  const entries = snapshot.adjudications.filter((a) => a.taskType === taskType)
  return new Map(entries.map((a) => [a.sampleId, a] as const))
}

function detectConflictFields(taskType: TaskType, annsAB: AnnotationRecordNormalized[]) {
  if (annsAB.length < 2) return []
  const [a, b] = annsAB
  const fieldsByTask: Record<TaskType, string[]> = {
    ai_sentence_audit: ['is_ai_true'],
    role_audit_qa_turns: ['role_true'],
    qa_boundary_audit_docs: ['boundary_correct', 'pairing_quality'],
    initiation_audit_exchanges: ['question_is_ai_true', 'answer_is_ai_true', 'initiation_type_true'],
  }
  const left = a.annotation as unknown as Record<string, unknown>
  const right = b.annotation as unknown as Record<string, unknown>
  return fieldsByTask[taskType].filter((field) => left[field] !== right[field])
}

export function getAdjudicationStatus(
  taskType: TaskType,
  formalAnnotationsForSample: AnnotationRecordNormalized[],
  adjudication?: AdjudicationRecordNormalized,
): AdjudicationStatus {
  if (adjudication) return 'adjudicated'
  if (formalAnnotationsForSample.length < 2) return 'not_double_annotated'
  const annsAB = [...formalAnnotationsForSample].sort(stableAnnSort).slice(0, 2)
  return detectConflictFields(taskType, annsAB).length > 0
    ? 'double_annotated_conflict'
    : 'double_annotated_no_conflict'
}

export function computeTaskProgressSummary(
  snapshot: DataStoreSnapshot,
  config: TaskConfig,
  options?: { includeTestUserData?: boolean; nowIso?: string },
): TaskProgressSummary {
  const taskItems = getTaskItems(snapshot, config.taskType)
  const anns = getTaskAnnotations(snapshot, config.taskType, {
    includeTestUserData: options?.includeTestUserData,
  })
  const formalAnns = getFormalTaskAnnotations(snapshot, config.taskType)
  const annsBySample = groupBySample(anns)
  const formalBySample = groupBySample(formalAnns)
  const adjudicationMap = getAdjudicationMap(snapshot, config.taskType)
  const now = options?.nowIso ?? new Date().toISOString()

  let single = 0
  let dbl = 0
  let adj = 0
  let singleOnly = 0
  let zero = 0
  let inProgress = 0
  let needsAdjudication = 0

  const activeClaimedSampleIds = new Set(
    snapshot.claims
      .filter(
        (c) =>
          c.taskType === config.taskType &&
          c.status === 'claimed' &&
          c.expiresAt > now,
      )
      .map((c) => c.sampleId),
  )

  for (const item of taskItems) {
    const bySample = annsBySample.get(item.sampleId) ?? []
    const formal = [...(formalBySample.get(item.sampleId) ?? [])].sort(stableAnnSort)
    if (bySample.length === 0) zero += 1
    if (bySample.length >= 1) single += 1
    if (formal.length === 1) singleOnly += 1
    if (formal.length >= 2) dbl += 1
    if (adjudicationMap.has(item.sampleId)) adj += 1
    const status = getAdjudicationStatus(config.taskType, formal, adjudicationMap.get(item.sampleId))
    if (status === 'double_annotated_conflict' || status === 'double_annotated_no_conflict') {
      needsAdjudication += 1
    }
    if (activeClaimedSampleIds.has(item.sampleId)) inProgress += 1
  }

  let coverageStatus: CoverageLabelStatus[] | undefined
  if (config.coverageLabels?.length && config.targetMinPerLabel) {
    const counts = new Map(config.coverageLabels.map((l) => [l, 0]))
    for (const adjRecord of snapshot.adjudications.filter((a) => a.taskType === config.taskType)) {
      let label: unknown
      if (config.taskType === 'role_audit_qa_turns') label = adjRecord.adjudicated.adjudicated_role_true
      if (config.taskType === 'initiation_audit_exchanges') {
        label = adjRecord.adjudicated.adjudicated_initiation_type_true
      }
      if (typeof label === 'string' && counts.has(label)) {
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
    }
    coverageStatus = config.coverageLabels.map((labelName) => ({
      labelName,
      adjudicatedCount: counts.get(labelName) ?? 0,
      targetMinPerLabel: config.targetMinPerLabel!,
      isLabelTargetMet: (counts.get(labelName) ?? 0) >= config.targetMinPerLabel!,
    }))
  }

  return {
    taskType: config.taskType,
    taskDisplayName: config.displayName,
    totalItems: taskItems.length,
    singleAnnotatedCount: single,
    doubleAnnotatedCount: dbl,
    adjudicatedCount: adj,
    singleOnlyCount: singleOnly,
    zeroAnnotatedCount: zero,
    inProgressCount: inProgress,
    needsAdjudicationCount: needsAdjudication,
    remainingToDoubleTarget: Math.max(config.targetTotalCompleted - dbl, 0),
    targetTotalCompleted: config.targetTotalCompleted,
    completionRate: config.targetTotalCompleted > 0 ? dbl / config.targetTotalCompleted : 0,
    isTargetMet: dbl >= config.targetTotalCompleted,
    targetMinPerLabel: config.targetMinPerLabel,
    coverageStatus,
  }
}

export function computeAllTaskProgress(
  snapshot: DataStoreSnapshot,
  configs: TaskConfig[],
  options?: { includeTestUserData?: boolean; nowIso?: string },
) {
  return TASK_ORDER.map((taskType) => {
    const config = configs.find((c) => c.taskType === taskType)
    if (!config) {
      throw new Error(`Missing task config for ${taskType}`)
    }
    return computeTaskProgressSummary(snapshot, config, options)
  })
}

export function buildUserProgress(
  snapshot: DataStoreSnapshot,
  users: AppUser[],
): UserProgressRow[] {
  const byUser = new Map<string, AnnotationRecordNormalized[]>()
  for (const ann of snapshot.annotations) {
    const list = byUser.get(ann.userId) ?? []
    list.push(ann)
    byUser.set(ann.userId, list)
  }
  const adjudicationsByUser = new Map<string, number>()
  for (const adj of snapshot.adjudications) {
    adjudicationsByUser.set(adj.adjudicatedBy, (adjudicationsByUser.get(adj.adjudicatedBy) ?? 0) + 1)
  }

  return users.map((u) => {
    const anns = byUser.get(u.id) ?? []
    const formal = anns.filter((a) => a.mode === 'annotator')
    const role: UserProgressRow['role'] = u.canAdjudicate && u.isTestUser ? 'test' : 'annotator'
    const countTask = (taskType: TaskType) => formal.filter((a) => a.taskType === taskType).length
    const lastActivityCandidates = [
      ...anns.map((a) => a.submittedAt),
      ...snapshot.adjudications.filter((a) => a.adjudicatedBy === u.id).map((a) => a.adjudicatedAt),
    ].sort()
    return {
      userName: u.displayName,
      role,
      completedTotal: formal.length,
      aiSentenceCompleted: countTask('ai_sentence_audit'),
      roleCompleted: countTask('role_audit_qa_turns'),
      boundaryCompleted: countTask('qa_boundary_audit_docs'),
      initiationCompleted: countTask('initiation_audit_exchanges'),
      adjudicationCompletedCount: adjudicationsByUser.get(u.id) ?? 0,
      lastActivityAt: lastActivityCandidates.at(-1),
    }
  }).concat(
    users
      .filter((u) => u.isTestUser)
      .map((u) => ({
        userName: `${u.displayName} (test mode)` ,
        role: 'test' as const,
        completedTotal: testCount(snapshot.annotations, u.id),
        aiSentenceCompleted: testCountByTask(snapshot.annotations, u.id, 'ai_sentence_audit'),
        roleCompleted: testCountByTask(snapshot.annotations, u.id, 'role_audit_qa_turns'),
        boundaryCompleted: testCountByTask(snapshot.annotations, u.id, 'qa_boundary_audit_docs'),
        initiationCompleted: testCountByTask(snapshot.annotations, u.id, 'initiation_audit_exchanges'),
        adjudicationCompletedCount: 0,
        lastActivityAt: snapshot.annotations
          .filter((a) => a.userId === u.id && a.mode === 'test')
          .map((a) => a.submittedAt)
          .sort()
          .at(-1),
      })),
  )
}

function testCount(annotations: AnnotationRecordNormalized[], userId: string) {
  return annotations.filter((a) => a.userId === userId && a.mode === 'test').length
}

function testCountByTask(
  annotations: AnnotationRecordNormalized[],
  userId: string,
  taskType: TaskType,
) {
  return annotations.filter((a) => a.userId === userId && a.mode === 'test' && a.taskType === taskType).length
}

export function claimBatchInSnapshot(input: {
  snapshot: DataStoreSnapshot
  taskType: TaskType
  userId: string
  mode: UserMode
  batchSize: number
  nowIso?: string
  claimTtlMinutes?: number
}): BatchClaimResult {
  const now = input.nowIso ?? new Date().toISOString()
  const ttlMinutes = input.claimTtlMinutes ?? 60
  const formalAnns = getFormalTaskAnnotations(input.snapshot, input.taskType)
  const formalBySample = groupBySample(formalAnns)
  const allItems = getTaskItems(input.snapshot, input.taskType)
  const alreadyDouble = new Set<string>()
  const singleOnlyCandidates: { sampleId: string; annotatedUserIds: string[] }[] = []
  const zeroCandidates: string[] = []

  for (const item of allItems) {
    const anns = formalBySample.get(item.sampleId) ?? []
    const uniqueUsers = [...new Set(anns.map((a) => a.userId))]
    if (uniqueUsers.length >= 2) {
      alreadyDouble.add(item.sampleId)
      continue
    }
    if (uniqueUsers.length === 1) {
      singleOnlyCandidates.push({ sampleId: item.sampleId, annotatedUserIds: uniqueUsers })
    } else {
      zeroCandidates.push(item.sampleId)
    }
  }

  const activeClaims = input.snapshot.claims.filter(
    (c) => c.taskType === input.taskType && c.status === 'claimed' && c.expiresAt > now,
  )
  const blockedByClaims = new Set(activeClaims.map((c) => c.sampleId))

  const currentUserAnnSamples = input.snapshot.annotations
    .filter((a) => a.taskType === input.taskType && a.userId === input.userId)
    .map((a) => a.sampleId)

  const allocation = allocateBatch({
    batchSize: input.batchSize,
    currentUserId: input.userId,
    singleOnlyCandidates: singleOnlyCandidates.filter((c) => !blockedByClaims.has(c.sampleId)),
    zeroCandidates: zeroCandidates.filter((id) => !blockedByClaims.has(id)),
    alreadyDoubleAnnotated: [...alreadyDouble],
    currentUserAnnotatedSampleIds: currentUserAnnSamples,
  })

  const batchId = `batch-${input.taskType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const expiresAt = new Date(new Date(now).getTime() + ttlMinutes * 60_000).toISOString()
  for (const sampleId of allocation.assignedSampleIds) {
    input.snapshot.claims.push({
      id: `claim-${batchId}-${sampleId}`,
      batchId,
      taskType: input.taskType,
      sampleId,
      userId: input.userId,
      mode: input.mode,
      status: 'claimed',
      claimedAt: now,
      expiresAt,
    })
  }

  return {
    batchId,
    taskType: input.taskType,
    sampleIds: allocation.assignedSampleIds,
    toDoubleCount: allocation.toDoubleCount,
    newItemCount: allocation.newItemCount,
  }
}

export function buildBatchView(input: {
  snapshot: DataStoreSnapshot
  taskType: TaskType
  batchId: string
  userId: string
}): { batchId: string; taskType: TaskType; items: BatchItemView[] } {
  const claims = input.snapshot.claims
    .filter((c) => c.batchId === input.batchId && c.taskType === input.taskType)
    .sort((a, b) => {
      const bySampleId = a.sampleId.localeCompare(b.sampleId)
      if (bySampleId !== 0) return bySampleId
      return a.id.localeCompare(b.id)
    })
  const seenSampleIds = new Set<string>()
  const uniqueClaims = claims.filter((claim) => {
    if (seenSampleIds.has(claim.sampleId)) return false
    seenSampleIds.add(claim.sampleId)
    return true
  })

  const items = uniqueClaims
    .map((claim) => {
      const taskItem = input.snapshot.taskItems.find(
        (it) => it.taskType === input.taskType && it.sampleId === claim.sampleId,
      )
      if (!taskItem) return undefined
      const existingMyAnnotation = input.snapshot.annotations.find(
        (ann) => ann.taskType === input.taskType && ann.sampleId === claim.sampleId && ann.userId === input.userId,
      )
      return {
        taskItem,
        context: input.snapshot.transcriptContexts[taskItem.docId],
        existingMyAnnotation,
      }
    })
    .filter(Boolean) as BatchItemView[]

  return { batchId: input.batchId, taskType: input.taskType, items }
}

export function saveAnnotationInSnapshot(input: {
  snapshot: DataStoreSnapshot
  taskType: TaskType
  sampleId: string
  user: { id: string; displayName: string }
  mode: 'annotator' | 'test'
  annotation: Record<string, unknown>
  batchId?: string
  nowIso?: string
}) {
  const now = input.nowIso ?? new Date().toISOString()
  const existing = input.snapshot.annotations.find(
    (ann) =>
      ann.taskType === input.taskType &&
      ann.sampleId === input.sampleId &&
      ann.userId === input.user.id &&
      ann.mode === input.mode,
  )
  if (existing) {
    existing.annotation = input.annotation as never
    existing.submittedAt = now
  } else {
    input.snapshot.annotations.push({
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      taskType: input.taskType,
      sampleId: input.sampleId,
      userId: input.user.id,
      userName: input.user.displayName,
      mode: input.mode,
      annotation: input.annotation as never,
      submittedAt: now,
      claimId: input.batchId,
    })
  }
  for (const claim of input.snapshot.claims) {
    if (
      claim.batchId === input.batchId &&
      claim.taskType === input.taskType &&
      claim.sampleId === input.sampleId &&
      claim.userId === input.user.id
    ) {
      claim.status = 'submitted'
    }
  }
}

export function listAdjudicationQueue(
  snapshot: DataStoreSnapshot,
  options?: { taskType?: TaskType; onlyConflicts?: boolean },
): AdjudicationQueueRow[] {
  const rows: AdjudicationQueueRow[] = []
  for (const item of snapshot.taskItems) {
    if (options?.taskType && item.taskType !== options.taskType) continue
    const formal = snapshot.annotations
      .filter((a) => a.taskType === item.taskType && a.sampleId === item.sampleId && a.mode === 'annotator')
      .sort(stableAnnSort)
    const adj = snapshot.adjudications.find((a) => a.taskType === item.taskType && a.sampleId === item.sampleId)
    const status = getAdjudicationStatus(item.taskType, formal, adj)
    const isNeeded = status === 'double_annotated_no_conflict' || status === 'double_annotated_conflict'
    if (!isNeeded && !adj) continue
    if (options?.onlyConflicts && status !== 'double_annotated_conflict') continue
    rows.push({
      sampleId: item.sampleId,
      taskType: item.taskType,
      docId: item.docId,
      status,
      updatedAt: adj?.adjudicatedAt ?? formal.at(-1)?.submittedAt ?? item.createdAt,
    })
  }
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getAdjudicationDetail(
  snapshot: DataStoreSnapshot,
  taskType: TaskType,
  sampleId: string,
): AdjudicationDetailView {
  const taskItem = snapshot.taskItems.find((it) => it.taskType === taskType && it.sampleId === sampleId)
  if (!taskItem) throw new Error('Task item not found')
  const formal = snapshot.annotations
    .filter((a) => a.taskType === taskType && a.sampleId === sampleId && a.mode === 'annotator')
    .sort(stableAnnSort)
  const annotationsAB = formal.slice(0, 2)
  const adjudication = snapshot.adjudications.find((a) => a.taskType === taskType && a.sampleId === sampleId)
  const conflictFields = detectConflictFields(taskType, annotationsAB)
  const status = getAdjudicationStatus(taskType, formal, adjudication)
  return {
    taskItem,
    context: snapshot.transcriptContexts[taskItem.docId],
    annotationsAB,
    adjudication,
    status,
    conflictFields,
  }
}

export function saveAdjudicationInSnapshot(input: {
  snapshot: DataStoreSnapshot
  taskType: TaskType
  sampleId: string
  adjudicatedBy: string
  adjudicated: Record<string, unknown>
  notes?: string
  autoFilled?: boolean
  nowIso?: string
}) {
  const now = input.nowIso ?? new Date().toISOString()
  const existing = input.snapshot.adjudications.find(
    (a) => a.taskType === input.taskType && a.sampleId === input.sampleId,
  )
  if (existing) {
    existing.adjudicated = input.adjudicated
    existing.notes = input.notes
    existing.adjudicatedBy = input.adjudicatedBy
    existing.adjudicatedAt = now
    existing.autoFilled = input.autoFilled
    return
  }
  input.snapshot.adjudications.push({
    id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    taskType: input.taskType,
    sampleId: input.sampleId,
    adjudicated: input.adjudicated,
    notes: input.notes,
    adjudicatedBy: input.adjudicatedBy,
    adjudicatedAt: now,
    autoFilled: input.autoFilled,
  })
}

export function autoFillConsistentAdjudications(snapshot: DataStoreSnapshot, adjudicatedBy: string) {
  let updatedCount = 0
  for (const item of snapshot.taskItems) {
    const detail = getAdjudicationDetail(snapshot, item.taskType, item.sampleId)
    if (detail.status !== 'double_annotated_no_conflict') continue
    const [a] = detail.annotationsAB
    if (!a) continue
      const adjudicated = autoFillAdjudicationPayload(
        item.taskType,
        a.annotation as unknown as Record<string, unknown>,
      )
    saveAdjudicationInSnapshot({
      snapshot,
      taskType: item.taskType,
      sampleId: item.sampleId,
      adjudicatedBy,
      adjudicated,
      notes: 'Auto-filled from matching A/B labels',
      autoFilled: true,
    })
    updatedCount += 1
  }
  return { updatedCount }
}

function autoFillAdjudicationPayload(taskType: TaskType, annotation: Record<string, unknown>) {
  switch (taskType) {
    case 'ai_sentence_audit':
      return { adjudicated_is_ai_true: annotation.is_ai_true }
    case 'role_audit_qa_turns':
      return { adjudicated_role_true: annotation.role_true }
    case 'qa_boundary_audit_docs':
      return {
        adjudicated_boundary_correct: annotation.boundary_correct,
        adjudicated_pairing_quality: annotation.pairing_quality,
      }
    case 'initiation_audit_exchanges':
      return {
        adjudicated_question_is_ai_true: annotation.question_is_ai_true,
        adjudicated_answer_is_ai_true: annotation.answer_is_ai_true,
        adjudicated_initiation_type_true: annotation.initiation_type_true,
      }
  }
}

export function buildExportRows(snapshot: DataStoreSnapshot, request: ExportRequest) {
  const items = snapshot.taskItems.filter((it) => it.taskType === request.taskType)
  const anns = snapshot.annotations.filter((ann) => {
    if (ann.taskType !== request.taskType) return false
    if (!request.includeTestUserData && ann.mode === 'test') return false
    return true
  })
  const annsBySample = groupBySample(anns)
  const formalBySample = groupBySample(anns.filter((a) => a.mode === 'annotator'))
  const adjudicationMap = new Map(
    snapshot.adjudications
      .filter((a) => a.taskType === request.taskType)
      .map((a) => [a.sampleId, a]),
  )

  if (request.scope === 'all_annotations') {
    return anns.map((ann) => ({
      task_type: ann.taskType,
      sample_id: ann.sampleId,
      user_name: ann.userName,
      user_id: ann.userId,
      mode: ann.mode,
      submitted_at: ann.submittedAt,
      annotation_json: JSON.stringify(ann.annotation),
    }))
  }

  const rows = items.flatMap((item) => {
    const anyAnns = annsBySample.get(item.sampleId) ?? []
    const formal = [...(formalBySample.get(item.sampleId) ?? [])].sort(stableAnnSort)
    const adjudication = adjudicationMap.get(item.sampleId)
    if (request.scope === 'single' && anyAnns.length < 1) return []
    if (request.scope === 'double' && formal.length < 2) return []
    if (request.scope === 'adjudicated' && !adjudication) return []
    return [
      buildDoubleAnnotatedExportRow({
        taskType: item.taskType,
        baseRow: item.payload as unknown as Record<string, unknown>,
        formalAnnotations: formal.map((f) => ({
          id: f.id,
          userName: f.userName,
          submittedAt: f.submittedAt,
          annotation: f.annotation as unknown as Record<string, unknown>,
        })),
        adjudication: adjudication
          ? { ...adjudication.adjudicated, notes: adjudication.notes }
          : undefined,
      }),
    ]
  })

  return rows
}

export function findNextAdjudicationCandidate(
  queue: AdjudicationQueueRow[],
  current: { taskType: TaskType; sampleId: string },
) {
  const idx = queue.findIndex((q) => q.taskType === current.taskType && q.sampleId === current.sampleId)
  return idx >= 0 ? queue[idx + 1] : undefined
}

export function getContextAroundTurn(
  context: TranscriptDocContext | undefined,
  turnIdx: number,
  radius: number,
) {
  if (!context) return []
  const turns = context.qaTurns
  const pos = turns.findIndex((t) => t.idx === turnIdx)
  if (pos === -1) return turns.slice(0, Math.min(turns.length, radius * 2 + 1))
  return turns.slice(Math.max(0, pos - radius), pos + radius + 1)
}
