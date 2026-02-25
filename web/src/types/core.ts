export type TaskType =
  | 'ai_sentence_audit'
  | 'role_audit_qa_turns'
  | 'qa_boundary_audit_docs'
  | 'initiation_audit_exchanges'

export type AppMode = 'annotator' | 'test' | 'adjudicator'

export interface AnnotationRecord {
  id: string
  taskType: TaskType
  sampleId: string
  userId: string
  userName: string
  mode: AppMode
  submittedAt: string
  annotation: Record<string, unknown>
  notes?: string | null
}

export interface AdjudicationRecord {
  taskType: TaskType
  sampleId: string
  adjudicated: Record<string, unknown>
  notes?: string | null
  adjudicatedBy?: string
  adjudicatedAt?: string
}

export interface SingleOnlyCandidate {
  sampleId: string
  annotatedUserIds: string[]
}
