import { CLAIM_TTL_MINUTES } from '../config/defaults'
import { toCsv } from '../lib/csv'
import {
  autoFillConsistentAdjudications,
  buildBatchView,
  buildExportRows,
  buildUserProgress,
  claimBatchInSnapshot,
  computeAllTaskProgress,
  getAdjudicationDetail,
  listAdjudicationQueue,
  saveAdjudicationInSnapshot,
  saveAnnotationInSnapshot,
} from '../lib/progress'
import { createMockSeedSnapshot } from '../test-data/mockSeed'
import type {
  AdminConfigUpdate,
  AnnotationInput,
  AppUser,
  DataStoreSnapshot,
  ExportRequest,
  ExportResult,
  SessionSelection,
  TaskConfig,
  TaskType,
} from '../types/schema'
import type { DataService, LobbyData } from './types'

const STORAGE_KEY = 'tmfe-annotation-webapp-mock-db-v2'

function loadSnapshot(): DataStoreSnapshot {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const seed = createMockSeedSnapshot()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
    return seed
  }
  return JSON.parse(raw) as DataStoreSnapshot
}

function saveSnapshot(snapshot: DataStoreSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

function requireUser(snapshot: DataStoreSnapshot, userId: string): AppUser {
  const user = snapshot.users.find((u) => u.id === userId)
  if (!user) throw new Error('User not found')
  return user
}

function ensureAnnotatableMode(mode: SessionSelection['mode']) {
  if (mode === 'adjudicator') {
    throw new Error('Adjudicator mode cannot submit annotations')
  }
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

export class MockDataService implements DataService {
  async getUsers() {
    return loadSnapshot().users
  }

  async getTaskConfigs() {
    return loadSnapshot().taskConfigs
  }

  async getLobbyData(session: SessionSelection, includeTestUserData: boolean) {
    const snapshot = loadSnapshot()
    return buildLobby(snapshot, session, includeTestUserData)
  }

  async getDashboardData(includeTestUserData: boolean) {
    const snapshot = loadSnapshot()
    return {
      taskProgress: computeAllTaskProgress(snapshot, snapshot.taskConfigs, { includeTestUserData }),
      userProgress: buildUserProgress(snapshot, snapshot.users),
      taskConfigs: snapshot.taskConfigs,
    }
  }

  async claimBatch(input: { session: SessionSelection; taskType: TaskType; batchSize: number }) {
    const snapshot = loadSnapshot()
    const result = claimBatchInSnapshot({
      snapshot,
      taskType: input.taskType,
      userId: input.session.userId,
      mode: input.session.mode,
      batchSize: input.batchSize,
      claimTtlMinutes: CLAIM_TTL_MINUTES,
    })
    saveSnapshot(snapshot)
    return result
  }

  async getBatch(input: { session: SessionSelection; taskType: TaskType; batchId: string }) {
    const snapshot = loadSnapshot()
    return buildBatchView({
      snapshot,
      batchId: input.batchId,
      taskType: input.taskType,
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
    const snapshot = loadSnapshot()
    ensureAnnotatableMode(input.session.mode)
    const user = requireUser(snapshot, input.session.userId)
    const mode = input.session.mode as 'annotator' | 'test'
    saveAnnotationInSnapshot({
      snapshot,
      taskType: input.taskType,
      sampleId: input.sampleId,
      user: { id: user.id, displayName: user.displayName },
      mode,
      annotation: input.annotation as unknown as Record<string, unknown>,
      batchId: input.batchId,
    })
    saveSnapshot(snapshot)
  }

  async listAdjudicationQueue(input: { taskType?: TaskType; onlyConflicts?: boolean }) {
    const snapshot = loadSnapshot()
    return listAdjudicationQueue(snapshot, input)
  }

  async getAdjudicationDetail(taskType: TaskType, sampleId: string) {
    const snapshot = loadSnapshot()
    return getAdjudicationDetail(snapshot, taskType, sampleId)
  }

  async saveAdjudication(input: {
    session: SessionSelection
    taskType: TaskType
    sampleId: string
    adjudicated: Record<string, unknown>
    notes?: string
  }) {
    if (input.session.mode !== 'adjudicator') {
      throw new Error('Only adjudicator mode can save adjudication')
    }
    const snapshot = loadSnapshot()
    saveAdjudicationInSnapshot({
      snapshot,
      taskType: input.taskType,
      sampleId: input.sampleId,
      adjudicatedBy: input.session.userId,
      adjudicated: input.adjudicated,
      notes: input.notes,
    })
    saveSnapshot(snapshot)
  }

  async autoFillMatchingAdjudications(session: SessionSelection) {
    if (session.mode !== 'adjudicator') {
      throw new Error('Only adjudicator can run auto-fill')
    }
    const snapshot = loadSnapshot()
    const result = autoFillConsistentAdjudications(snapshot, session.userId)
    saveSnapshot(snapshot)
    return result
  }

  async exportCsv(request: ExportRequest): Promise<ExportResult> {
    const snapshot = loadSnapshot()
    const rows = buildExportRows(snapshot, request)
    const csvText = toCsv(rows)
    const filename = `${request.taskType}__${request.scope}.csv`
    return { filename, csvText, rowCount: rows.length }
  }

  async updateTaskConfig(update: AdminConfigUpdate) {
    const snapshot = loadSnapshot()
    const config = snapshot.taskConfigs.find((c) => c.taskType === update.taskType)
    if (!config) throw new Error('Task config not found')
    Object.assign(config, {
      ...(update.targetTotalCompleted !== undefined
        ? { targetTotalCompleted: update.targetTotalCompleted }
        : {}),
      ...(update.targetMinPerLabel !== undefined
        ? { targetMinPerLabel: update.targetMinPerLabel }
        : {}),
      ...(update.coverageLabels !== undefined ? { coverageLabels: update.coverageLabels } : {}),
      ...(update.excludeTestByDefault !== undefined
        ? { excludeTestByDefault: update.excludeTestByDefault }
        : {}),
      ...(update.batchStrategy !== undefined ? { batchStrategy: update.batchStrategy } : {}),
      ...(update.batchRatio !== undefined ? { batchRatio: update.batchRatio } : {}),
    } satisfies Partial<TaskConfig>)
    saveSnapshot(snapshot)
  }
}

export function resetMockData() {
  localStorage.removeItem(STORAGE_KEY)
}
