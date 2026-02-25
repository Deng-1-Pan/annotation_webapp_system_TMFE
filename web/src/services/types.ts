import type {
  AdminConfigUpdate,
  AdjudicationDetailView,
  AdjudicationQueueRow,
  AnnotationBatchView,
  AnnotationInput,
  AppUser,
  AutoFillResult,
  BatchClaimResult,
  ExportRequest,
  ExportResult,
  SessionSelection,
  TaskConfig,
  TaskProgressSummary,
  TaskType,
  UserProgressRow,
} from '../types/schema'

export interface LobbyData {
  currentUser: AppUser
  mode: SessionSelection['mode']
  includeTestUserData: boolean
  taskConfigs: TaskConfig[]
  taskProgress: TaskProgressSummary[]
  userProgress: UserProgressRow[]
}

export interface DataService {
  getUsers(): Promise<AppUser[]>
  getTaskConfigs(): Promise<TaskConfig[]>
  getLobbyData(session: SessionSelection, includeTestUserData: boolean): Promise<LobbyData>
  getDashboardData(includeTestUserData: boolean): Promise<{
    taskProgress: TaskProgressSummary[]
    userProgress: UserProgressRow[]
    taskConfigs: TaskConfig[]
  }>
  claimBatch(input: {
    session: SessionSelection
    taskType: TaskType
    batchSize: number
  }): Promise<BatchClaimResult>
  getBatch(input: { session: SessionSelection; taskType: TaskType; batchId: string }): Promise<AnnotationBatchView>
  saveAnnotation(input: {
    session: SessionSelection
    taskType: TaskType
    sampleId: string
    batchId: string
    annotation: AnnotationInput
  }): Promise<void>
  listAdjudicationQueue(input: { taskType?: TaskType; onlyConflicts?: boolean }): Promise<AdjudicationQueueRow[]>
  getAdjudicationDetail(taskType: TaskType, sampleId: string): Promise<AdjudicationDetailView>
  saveAdjudication(input: {
    session: SessionSelection
    taskType: TaskType
    sampleId: string
    adjudicated: Record<string, unknown>
    notes?: string
  }): Promise<void>
  autoFillMatchingAdjudications(session: SessionSelection): Promise<AutoFillResult>
  exportCsv(request: ExportRequest): Promise<ExportResult>
  updateTaskConfig(update: AdminConfigUpdate): Promise<void>
}
