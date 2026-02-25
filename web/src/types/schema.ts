import type { TaskType as CoreTaskType, AppMode } from './core'

export type TaskType = CoreTaskType
export type UserMode = AppMode

export interface AppUser {
  id: string
  displayName: string
  isTestUser: boolean
  canAdjudicate: boolean
  isActive: boolean
}

export interface SessionSelection {
  userId: string
  mode: UserMode
}

export interface TaskConfig {
  taskType: TaskType
  displayName: string
  description: string
  targetTotalCompleted: number
  targetMinPerLabel?: number
  coverageLabels?: string[]
  excludeTestByDefault: boolean
  batchStrategy: 'auto_mixed' | 'ratio_mixed'
  batchRatio?: number
}

export interface AiSentenceTaskItem {
  sample_id: string
  doc_id: string
  section: string
  text: string
  kw_is_ai_pred: number
  annotator_a_is_ai_true?: number | null
  annotator_b_is_ai_true?: number | null
  adjudicated_is_ai_true?: number | null
  false_positive_type?: string | null
  notes?: string | null
}

export interface RoleAuditTaskItem {
  sample_id: string
  doc_id: string
  turn_idx: number
  speaker: string
  text: string
  role_pred: string
  turn_kw_is_ai_pred: number
  n_sentences_in_turn: number
  annotator_a_role_true?: string | null
  annotator_b_role_true?: string | null
  adjudicated_role_true?: string | null
  notes?: string | null
}

export interface BoundaryAuditTaskItem {
  sample_id: string
  doc_id: string
  ticker: string
  year: number
  quarter: number
  overall_kw_ai_ratio: number
  speech_kw_ai_ratio: number
  qa_kw_ai_ratio: number
  speech_turn_count_pred: number
  qa_turn_count_pred: number
  num_qa_exchanges_pred_parser: number
  speech_tail_preview: string
  qa_head_preview: string
  annotator_a_boundary_correct?: number | null
  annotator_b_boundary_correct?: number | null
  adjudicated_boundary_correct?: number | null
  annotator_a_pairing_quality?: string | null
  annotator_b_pairing_quality?: string | null
  adjudicated_pairing_quality?: string | null
  notes?: string | null
}

export interface InitiationAuditTaskItem {
  sample_id: string
  doc_id: string
  exchange_idx: number
  questioner: string
  answerer: string
  question_text: string
  answer_text: string
  question_is_ai_pred: number
  answer_is_ai_pred: number
  initiation_type_pred: string
  annotator_a_question_is_ai_true?: number | null
  annotator_b_question_is_ai_true?: number | null
  adjudicated_question_is_ai_true?: number | null
  annotator_a_answer_is_ai_true?: number | null
  annotator_b_answer_is_ai_true?: number | null
  adjudicated_answer_is_ai_true?: number | null
  annotator_a_initiation_type_true?: string | null
  annotator_b_initiation_type_true?: string | null
  adjudicated_initiation_type_true?: string | null
  notes?: string | null
}

export type TaskItemPayload =
  | AiSentenceTaskItem
  | RoleAuditTaskItem
  | BoundaryAuditTaskItem
  | InitiationAuditTaskItem

export interface TaskItemRecord {
  id: string
  taskType: TaskType
  sampleId: string
  docId: string
  payload: TaskItemPayload
  sourceRow?: Record<string, unknown>
  createdAt: string
}

export interface TranscriptTurn {
  idx: number
  speaker: string
  text: string
  role?: string
  isQuestion?: boolean
  section?: 'speech' | 'qa'
}

export interface TranscriptDocContext {
  docId: string
  ticker?: string
  year?: number
  quarter?: number
  speechTurns: TranscriptTurn[]
  qaTurns: TranscriptTurn[]
  mergedTurns?: TranscriptTurn[]
}

export interface AnnotationInputAi {
  is_ai_true: 0 | 1
  false_positive_type?: string | null
  notes?: string | null
}

export interface AnnotationInputRole {
  role_true: 'analyst' | 'management' | 'operator' | 'unknown'
  notes?: string | null
}

export interface AnnotationInputBoundary {
  boundary_correct: 0 | 1
  pairing_quality: 'good' | 'minor_issue' | 'major_issue' | 'unusable'
  notes?: string | null
}

export interface AnnotationInputInitiation {
  question_is_ai_true: 0 | 1
  answer_is_ai_true: 0 | 1
  initiation_type_true: 'analyst_initiated' | 'management_pivot' | 'analyst_only' | 'non_ai'
  notes?: string | null
}

export type AnnotationInput =
  | AnnotationInputAi
  | AnnotationInputRole
  | AnnotationInputBoundary
  | AnnotationInputInitiation

export interface AnnotationRecordNormalized {
  id: string
  taskType: TaskType
  sampleId: string
  userId: string
  userName: string
  mode: 'annotator' | 'test'
  annotation: AnnotationInput
  submittedAt: string
  claimId?: string
}

export interface ClaimRecord {
  id: string
  batchId: string
  taskType: TaskType
  sampleId: string
  userId: string
  mode: UserMode
  status: 'claimed' | 'submitted' | 'expired' | 'released'
  claimedAt: string
  expiresAt: string
}

export interface AdjudicationRecordNormalized {
  id: string
  taskType: TaskType
  sampleId: string
  adjudicated: Record<string, unknown>
  notes?: string | null
  adjudicatedBy: string
  adjudicatedAt: string
  autoFilled?: boolean
}

export type AdjudicationStatus =
  | 'not_double_annotated'
  | 'double_annotated_no_conflict'
  | 'double_annotated_conflict'
  | 'adjudicated'

export interface CoverageLabelStatus {
  labelName: string
  adjudicatedCount: number
  targetMinPerLabel: number
  isLabelTargetMet: boolean
}

export interface TaskProgressSummary {
  taskType: TaskType
  taskDisplayName: string
  totalItems: number
  singleAnnotatedCount: number
  doubleAnnotatedCount: number
  adjudicatedCount: number
  singleOnlyCount: number
  zeroAnnotatedCount: number
  inProgressCount: number
  needsAdjudicationCount: number
  remainingToDoubleTarget: number
  targetTotalCompleted: number
  completionRate: number
  isTargetMet: boolean
  targetMinPerLabel?: number
  coverageStatus?: CoverageLabelStatus[]
}

export interface UserProgressRow {
  userName: string
  role: 'annotator' | 'test' | 'adjudicator'
  completedTotal: number
  aiSentenceCompleted: number
  roleCompleted: number
  boundaryCompleted: number
  initiationCompleted: number
  adjudicationCompletedCount: number
  lastActivityAt?: string
}

export interface LobbyTaskCardData {
  config: TaskConfig
  progress: TaskProgressSummary
}

export interface BatchClaimResult {
  batchId: string
  taskType: TaskType
  sampleIds: string[]
  toDoubleCount: number
  newItemCount: number
}

export interface BatchItemView {
  taskItem: TaskItemRecord
  context?: TranscriptDocContext
  existingMyAnnotation?: AnnotationRecordNormalized
}

export interface AnnotationBatchView {
  batchId: string
  taskType: TaskType
  items: BatchItemView[]
}

export interface AdjudicationQueueRow {
  sampleId: string
  taskType: TaskType
  docId: string
  status: AdjudicationStatus
  updatedAt: string
}

export interface AdjudicationDetailView {
  taskItem: TaskItemRecord
  context?: TranscriptDocContext
  annotationsAB: AnnotationRecordNormalized[]
  adjudication?: AdjudicationRecordNormalized
  status: AdjudicationStatus
  conflictFields: string[]
}

export interface ExportRequest {
  taskType: TaskType
  scope: 'single' | 'double' | 'adjudicated' | 'all_annotations'
  includeTestUserData: boolean
}

export interface ExportResult {
  filename: string
  csvText: string
  rowCount: number
}

export interface AdminConfigUpdate {
  taskType: TaskType
  targetTotalCompleted?: number
  targetMinPerLabel?: number
  coverageLabels?: string[]
  excludeTestByDefault?: boolean
  batchStrategy?: 'auto_mixed' | 'ratio_mixed'
  batchRatio?: number
}

export interface AutoFillResult {
  updatedCount: number
}

export interface DataStoreSnapshot {
  users: AppUser[]
  taskConfigs: TaskConfig[]
  taskItems: TaskItemRecord[]
  transcriptContexts: Record<string, TranscriptDocContext>
  claims: ClaimRecord[]
  annotations: AnnotationRecordNormalized[]
  adjudications: AdjudicationRecordNormalized[]
}
