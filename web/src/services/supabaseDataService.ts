import { CLAIM_TTL_MINUTES } from '../config/defaults'
import { toCsv } from '../lib/csv'
import {
  autoFillConsistentAdjudications,
  buildBatchView,
  buildExportRows,
  buildUserProgress,
  computeAllTaskProgress,
  getAdjudicationDetail,
  listAdjudicationQueue,
} from '../lib/progress'
import { supabase, hasSupabaseEnv } from './supabaseClient'
import type { DataService, LobbyData } from './types'
import type {
  AdminConfigUpdate,
  AnnotationInput,
  AppUser,
  BatchClaimResult,
  DataStoreSnapshot,
  ExportRequest,
  ExportResult,
  SessionSelection,
  TaskConfig,
  TaskItemRecord,
  TaskType,
  TranscriptDocContext,
} from '../types/schema'

function requireClient() {
  if (!hasSupabaseEnv || !supabase) {
    throw new Error('Supabase env not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  return supabase
}

function parseClaimBatchRpcResult(data: unknown): BatchClaimResult {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid claim_batch_atomic response: expected object')
  }
  const row = data as Record<string, unknown>
  const rawSampleIds = row.sample_ids
  if (!Array.isArray(rawSampleIds) || !rawSampleIds.every((v) => typeof v === 'string')) {
    throw new Error('Invalid claim_batch_atomic response: sample_ids')
  }
  const taskType = row.task_type
  if (typeof taskType !== 'string') {
    throw new Error('Invalid claim_batch_atomic response: task_type')
  }
  const batchId = row.batch_id
  if (typeof batchId !== 'string') {
    throw new Error('Invalid claim_batch_atomic response: batch_id')
  }
  const toDoubleCount = Number(row.to_double_count)
  const newItemCount = Number(row.new_item_count)
  if (!Number.isInteger(toDoubleCount) || !Number.isInteger(newItemCount)) {
    throw new Error('Invalid claim_batch_atomic response: counts')
  }
  return {
    batchId,
    taskType: taskType as TaskType,
    sampleIds: rawSampleIds,
    toDoubleCount,
    newItemCount,
  }
}

function rowToTaskItem(row: Record<string, unknown>): TaskItemRecord {
  return {
    id: String(row.id),
    taskType: row.task_type as TaskType,
    sampleId: String(row.sample_id),
    docId: String(row.doc_id),
    payload: (row.payload_json ?? {}) as TaskItemRecord['payload'],
    sourceRow: (row.source_row_json ?? undefined) as Record<string, unknown> | undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }
}

function rowToTaskConfig(row: Record<string, unknown>): TaskConfig {
  const labels = row.coverage_labels_json
  return {
    taskType: row.task_type as TaskType,
    displayName: String(row.display_name),
    description: String(row.description),
    targetTotalCompleted: Number(row.target_total_completed),
    targetMinPerLabel: row.target_min_per_label == null ? undefined : Number(row.target_min_per_label),
    coverageLabels: Array.isArray(labels) ? (labels as string[]) : undefined,
    excludeTestByDefault: Boolean(row.exclude_test_by_default),
    batchStrategy: (row.batch_strategy as TaskConfig['batchStrategy']) ?? 'auto_mixed',
    batchRatio: row.batch_ratio == null ? undefined : Number(row.batch_ratio),
  }
}

function rowToTranscriptContext(row: Record<string, unknown>): TranscriptDocContext {
  return {
    docId: String(row.doc_id),
    ticker: row.ticker == null ? undefined : String(row.ticker),
    year: row.year == null ? undefined : Number(row.year),
    quarter: row.quarter == null ? undefined : Number(row.quarter),
    speechTurns: (row.speech_turns_json ?? []) as TranscriptDocContext['speechTurns'],
    qaTurns: (row.qa_turns_json ?? []) as TranscriptDocContext['qaTurns'],
    mergedTurns: (row.merged_turns_json ?? []) as TranscriptDocContext['mergedTurns'],
  }
}

async function loadSnapshot(): Promise<DataStoreSnapshot> {
  const client = requireClient()
  // Supabase PostgREST defaults to 1000-row limit; use .range() to load all rows.
  const ALL = { from: 0, to: 9999 } as const
  const [usersRes, cfgRes, itemsRes, docsRes, claimsRes, annRes, adjRes] = await Promise.all([
    client.from('app_users').select('*').order('display_name', { ascending: true }),
    client.from('task_configs').select('*'),
    client.from('task_items').select('*').range(ALL.from, ALL.to),
    Promise.resolve({ data: [], error: null }), // transcript_docs are now fetched lazily
    client.from('claims').select('*').range(ALL.from, ALL.to),
    client.from('annotations').select('*').range(ALL.from, ALL.to),
    client.from('adjudications').select('*').range(ALL.from, ALL.to),
  ])

  for (const r of [usersRes, cfgRes, itemsRes, docsRes, claimsRes, annRes, adjRes]) {
    if (r.error) throw new Error(r.error.message)
  }

  return {
    users: (usersRes.data ?? []).map((r) => ({
      id: String(r.id),
      displayName: String(r.display_name),
      isTestUser: Boolean(r.is_test_user),
      canAdjudicate: Boolean(r.can_adjudicate),
      isActive: Boolean(r.is_active),
    })),
    taskConfigs: (cfgRes.data ?? []).map((r) => rowToTaskConfig(r as unknown as Record<string, unknown>)),
    taskItems: (itemsRes.data ?? []).map((r) => rowToTaskItem(r as unknown as Record<string, unknown>)),
    transcriptContexts: Object.fromEntries(
      (docsRes.data ?? []).map((r) => {
        const ctx = rowToTranscriptContext(r as unknown as Record<string, unknown>)
        return [ctx.docId, ctx]
      }),
    ),
    claims: (claimsRes.data ?? []).map((r) => ({
      id: String(r.id),
      batchId: String(r.batch_id),
      taskType: r.task_type as TaskType,
      sampleId: String(r.sample_id),
      userId: String(r.user_id),
      mode: r.mode as SessionSelection['mode'],
      status: r.status as 'claimed' | 'submitted' | 'expired' | 'released',
      claimedAt: String(r.claimed_at),
      expiresAt: String(r.expires_at),
    })),
    annotations: (annRes.data ?? []).map((r) => ({
      id: String(r.id),
      taskType: r.task_type as TaskType,
      sampleId: String(r.sample_id),
      userId: String(r.user_id),
      userName: '',
      mode: r.mode as 'annotator' | 'test',
      annotation: (r.annotation_json ?? {}) as AnnotationInput,
      submittedAt: String(r.submitted_at),
      claimId: r.source_claim_id == null ? undefined : String(r.source_claim_id),
    })),
    adjudications: (adjRes.data ?? []).map((r) => ({
      id: String(r.id),
      taskType: r.task_type as TaskType,
      sampleId: String(r.sample_id),
      adjudicated: (r.adjudicated_json ?? {}) as Record<string, unknown>,
      notes: r.adjudication_notes == null ? null : String(r.adjudication_notes),
      adjudicatedBy: String(r.adjudicated_by),
      adjudicatedAt: String(r.adjudicated_at),
      autoFilled: Boolean(r.auto_filled),
    })),
  }
}

function hydrateAnnotationUserNames(snapshot: DataStoreSnapshot) {
  const userMap = new Map(snapshot.users.map((u) => [u.id, u.displayName]))
  snapshot.annotations.forEach((ann) => {
    ann.userName = userMap.get(ann.userId) ?? ann.userId
  })
}

function requireUser(snapshot: DataStoreSnapshot, userId: string): AppUser {
  const user = snapshot.users.find((u) => u.id === userId)
  if (!user) throw new Error(`Unknown user ${userId}`)
  return user
}

function buildLobby(snapshot: DataStoreSnapshot, session: SessionSelection, includeTestUserData: boolean): LobbyData {
  const currentUser = requireUser(snapshot, session.userId)
  return {
    currentUser,
    mode: session.mode,
    includeTestUserData,
    taskConfigs: snapshot.taskConfigs,
    taskProgress: computeAllTaskProgress(snapshot, snapshot.taskConfigs, { includeTestUserData }),
    userProgress: buildUserProgress(snapshot, snapshot.users),
  }
}

export class SupabaseDataService implements DataService {
  async getUsers() {
    const snapshot = await loadSnapshot()
    return snapshot.users
  }

  async getTaskConfigs() {
    const snapshot = await loadSnapshot()
    return snapshot.taskConfigs
  }

  async getLobbyData(session: SessionSelection, includeTestUserData: boolean) {
    const snapshot = await loadSnapshot()
    hydrateAnnotationUserNames(snapshot)
    return buildLobby(snapshot, session, includeTestUserData)
  }

  async getDashboardData(includeTestUserData: boolean) {
    const snapshot = await loadSnapshot()
    hydrateAnnotationUserNames(snapshot)
    return {
      taskProgress: computeAllTaskProgress(snapshot, snapshot.taskConfigs, { includeTestUserData }),
      userProgress: buildUserProgress(snapshot, snapshot.users),
      taskConfigs: snapshot.taskConfigs,
    }
  }

  async claimBatch(input: { session: SessionSelection; taskType: TaskType; batchSize: number }) {
    const client = requireClient()
    const res = await client.rpc('claim_batch_atomic', {
      p_task_type: input.taskType,
      p_user_id: input.session.userId,
      p_mode: input.session.mode,
      p_batch_size: input.batchSize,
      p_claim_ttl_minutes: CLAIM_TTL_MINUTES,
    })
    if (res.error) throw new Error(res.error.message)
    return parseClaimBatchRpcResult(res.data)
  }

  async getBatch(input: { session: SessionSelection; taskType: TaskType; batchId: string }) {
    const snapshot = await loadSnapshot()

    // Identify needed docIds for this batch
    const claims = snapshot.claims.filter(
      (c) => c.batchId === input.batchId && c.taskType === input.taskType,
    )
    const docIdsToFetch = new Set<string>()
    for (const c of claims) {
      const item = snapshot.taskItems.find((it) => it.sampleId === c.sampleId && it.taskType === input.taskType)
      if (item) docIdsToFetch.add(item.docId)
    }

    // Lazily fetch only the transcripts needed for this batch
    if (docIdsToFetch.size > 0) {
      const client = requireClient()
      const docsRes = await client.from('transcript_docs').select('*').in('doc_id', Array.from(docIdsToFetch))
      if (docsRes.error) throw new Error(docsRes.error.message)
      for (const r of docsRes.data ?? []) {
        const ctx = rowToTranscriptContext(r as unknown as Record<string, unknown>)
        snapshot.transcriptContexts[ctx.docId] = ctx
      }
    }

    hydrateAnnotationUserNames(snapshot)
    return buildBatchView({
      snapshot,
      taskType: input.taskType,
      batchId: input.batchId,
      userId: input.session.userId,
    })
  }

  async saveAnnotation(input: {
    session: SessionSelection
    taskType: TaskType
    sampleId: string
    batchId: string
    annotation: AnnotationInput
  }) {
    if (input.session.mode === 'adjudicator') {
      throw new Error('Adjudicator mode cannot submit annotations')
    }
    const client = requireClient()
    const userRes = await client.from('app_users').select('*').eq('id', input.session.userId).single()
    if (userRes.error) throw new Error(userRes.error.message)
    const user = userRes.data
    if (input.session.mode === 'annotator') {
      const existingRes = await client
        .from('annotations')
        .select('user_id')
        .eq('task_type', input.taskType)
        .eq('sample_id', input.sampleId)
        .eq('mode', 'annotator')
      if (existingRes.error) throw new Error(existingRes.error.message)
      const existingAnnotatorIds = new Set(
        (existingRes.data ?? [])
          .map((row) => String((row as unknown as Record<string, unknown>).user_id ?? ''))
          .filter((id) => id.length > 0),
      )
      const alreadyContainsCurrentUser = existingAnnotatorIds.has(input.session.userId)
      if (!alreadyContainsCurrentUser && existingAnnotatorIds.size >= 2) {
        throw new Error('提交已被拦截：由于超时，该任务已被其他两位成员完成。')
      }
    }
    const payload = {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      task_type: input.taskType,
      sample_id: input.sampleId,
      user_id: input.session.userId,
      mode: input.session.mode,
      annotation_json: input.annotation as unknown as Record<string, unknown>,
      notes: String((input.annotation as unknown as Record<string, unknown>).notes ?? ''),
      source_claim_id: input.batchId,
      submitted_at: new Date().toISOString(),
    }
    const upsertRes = await client
      .from('annotations')
      .upsert(payload, { onConflict: 'task_type,sample_id,user_id,mode' })
    if (upsertRes.error) throw new Error(upsertRes.error.message)

    const updateClaimsRes = await client
      .from('claims')
      .update({ status: 'submitted' })
      .eq('batch_id', input.batchId)
      .eq('task_type', input.taskType)
      .eq('sample_id', input.sampleId)
      .eq('user_id', user.id)
    if (updateClaimsRes.error) throw new Error(updateClaimsRes.error.message)
  }

  async listAdjudicationQueue(input: { taskType?: TaskType; onlyConflicts?: boolean }) {
    const snapshot = await loadSnapshot()
    hydrateAnnotationUserNames(snapshot)
    return listAdjudicationQueue(snapshot, input)
  }

  async getAdjudicationDetail(taskType: TaskType, sampleId: string) {
    const snapshot = await loadSnapshot()

    // Find the task item to determine the docId
    const item = snapshot.taskItems.find((it) => it.sampleId === sampleId && it.taskType === taskType)
    if (item) {
      const client = requireClient()
      const docsRes = await client.from('transcript_docs').select('*').eq('doc_id', item.docId)
      if (docsRes.error) throw new Error(docsRes.error.message)
      for (const r of docsRes.data ?? []) {
        const ctx = rowToTranscriptContext(r as unknown as Record<string, unknown>)
        snapshot.transcriptContexts[ctx.docId] = ctx
      }
    }

    hydrateAnnotationUserNames(snapshot)
    return getAdjudicationDetail(snapshot, taskType, sampleId)
  }

  async saveAdjudication(input: {
    session: SessionSelection
    taskType: TaskType
    sampleId: string
    adjudicated: Record<string, unknown>
    notes?: string
  }) {
    if (input.session.mode !== 'adjudicator') throw new Error('Only adjudicator can save adjudication')
    const client = requireClient()
    const payload = {
      id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      task_type: input.taskType,
      sample_id: input.sampleId,
      adjudicated_json: input.adjudicated,
      adjudication_notes: input.notes ?? null,
      adjudicated_by: input.session.userId,
      adjudicated_at: new Date().toISOString(),
      auto_filled: false,
    }
    const res = await client
      .from('adjudications')
      .upsert(payload, { onConflict: 'task_type,sample_id' })
    if (res.error) throw new Error(res.error.message)
  }

  async autoFillMatchingAdjudications(session: SessionSelection) {
    if (session.mode !== 'adjudicator') throw new Error('Only adjudicator can auto-fill')
    const client = requireClient()
    const snapshot = await loadSnapshot()
    hydrateAnnotationUserNames(snapshot)
    const result = autoFillConsistentAdjudications(snapshot, session.userId)
    const toUpsert = snapshot.adjudications.map((a) => ({
      id: a.id,
      task_type: a.taskType,
      sample_id: a.sampleId,
      adjudicated_json: a.adjudicated,
      adjudication_notes: a.notes ?? null,
      adjudicated_by: a.adjudicatedBy,
      adjudicated_at: a.adjudicatedAt,
      auto_filled: Boolean(a.autoFilled),
    }))
    const res = await client.from('adjudications').upsert(toUpsert, { onConflict: 'task_type,sample_id' })
    if (res.error) throw new Error(res.error.message)
    return result
  }

  async exportCsv(request: ExportRequest): Promise<ExportResult> {
    const snapshot = await loadSnapshot()
    hydrateAnnotationUserNames(snapshot)
    const rows = buildExportRows(snapshot, request)
    return {
      filename: `${request.taskType}__${request.scope}.csv`,
      csvText: toCsv(rows),
      rowCount: rows.length,
    }
  }

  async updateTaskConfig(update: AdminConfigUpdate) {
    const client = requireClient()
    const current = await client.from('task_configs').select('*').eq('task_type', update.taskType).single()
    if (current.error) throw new Error(current.error.message)
    const row = current.data
    const payload = {
      task_type: row.task_type,
      display_name: row.display_name,
      description: row.description,
      target_total_completed: update.targetTotalCompleted ?? row.target_total_completed,
      target_min_per_label: update.targetMinPerLabel ?? row.target_min_per_label,
      coverage_labels_json: update.coverageLabels ?? row.coverage_labels_json,
      exclude_test_by_default: update.excludeTestByDefault ?? row.exclude_test_by_default,
      batch_strategy: update.batchStrategy ?? row.batch_strategy,
      batch_ratio: update.batchRatio ?? row.batch_ratio,
      updated_at: new Date().toISOString(),
    }
    const res = await client.from('task_configs').upsert(payload, { onConflict: 'task_type' })
    if (res.error) throw new Error(res.error.message)
  }
}
