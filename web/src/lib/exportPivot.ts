import type { TaskType } from '../types/core'

interface FormalAnnotationInput {
  id: string
  userName: string
  submittedAt: string
  annotation: Record<string, unknown>
}

interface BuildRowInput {
  taskType: TaskType
  baseRow: Record<string, unknown>
  formalAnnotations: FormalAnnotationInput[]
  adjudication?: Record<string, unknown> | null
}

function stableSortAnnotations(items: FormalAnnotationInput[]) {
  return [...items].sort((a, b) => {
    const byTime = a.submittedAt.localeCompare(b.submittedAt)
    if (byTime !== 0) return byTime
    return a.id.localeCompare(b.id)
  })
}

function setIfPresent(target: Record<string, unknown>, key: string, value: unknown) {
  if (value !== undefined) {
    target[key] = value
  }
}

export function buildDoubleAnnotatedExportRow(input: BuildRowInput): Record<string, unknown> {
  const row = { ...input.baseRow }
  const [a, b] = stableSortAnnotations(input.formalAnnotations).slice(0, 2)

  switch (input.taskType) {
    case 'role_audit_qa_turns': {
      setIfPresent(row, 'annotator_a_role_true', a?.annotation.role_true ?? null)
      setIfPresent(row, 'annotator_b_role_true', b?.annotation.role_true ?? null)
      setIfPresent(
        row,
        'adjudicated_role_true',
        input.adjudication?.adjudicated_role_true ?? row.adjudicated_role_true ?? null,
      )
      row.notes =
        (input.adjudication?.notes as string | undefined) ??
        (a?.annotation.notes as string | undefined) ??
        (b?.annotation.notes as string | undefined) ??
        row.notes ??
        null
      break
    }
    case 'ai_sentence_audit': {
      setIfPresent(row, 'annotator_a_is_ai_true', a?.annotation.is_ai_true ?? null)
      setIfPresent(row, 'annotator_b_is_ai_true', b?.annotation.is_ai_true ?? null)
      setIfPresent(
        row,
        'adjudicated_is_ai_true',
        input.adjudication?.adjudicated_is_ai_true ?? row.adjudicated_is_ai_true ?? null,
      )
      row.notes = (input.adjudication?.notes as string | undefined) ?? row.notes ?? null
      break
    }
    case 'qa_boundary_audit_docs': {
      setIfPresent(row, 'annotator_a_boundary_correct', a?.annotation.boundary_correct ?? null)
      setIfPresent(row, 'annotator_b_boundary_correct', b?.annotation.boundary_correct ?? null)
      setIfPresent(
        row,
        'annotator_a_pairing_quality',
        a?.annotation.pairing_quality ?? null,
      )
      setIfPresent(
        row,
        'annotator_b_pairing_quality',
        b?.annotation.pairing_quality ?? null,
      )
      setIfPresent(
        row,
        'adjudicated_boundary_correct',
        input.adjudication?.adjudicated_boundary_correct ?? row.adjudicated_boundary_correct ?? null,
      )
      setIfPresent(
        row,
        'adjudicated_pairing_quality',
        input.adjudication?.adjudicated_pairing_quality ?? row.adjudicated_pairing_quality ?? null,
      )
      row.notes = (input.adjudication?.notes as string | undefined) ?? row.notes ?? null
      break
    }
    case 'initiation_audit_exchanges': {
      const fill = (slot: 'a' | 'b', ann?: FormalAnnotationInput) => {
        setIfPresent(
          row,
          `annotator_${slot}_question_is_ai_true`,
          ann?.annotation.question_is_ai_true ?? null,
        )
        setIfPresent(
          row,
          `annotator_${slot}_answer_is_ai_true`,
          ann?.annotation.answer_is_ai_true ?? null,
        )
        setIfPresent(
          row,
          `annotator_${slot}_initiation_type_true`,
          ann?.annotation.initiation_type_true ?? null,
        )
      }
      fill('a', a)
      fill('b', b)
      setIfPresent(
        row,
        'adjudicated_question_is_ai_true',
        input.adjudication?.adjudicated_question_is_ai_true ?? row.adjudicated_question_is_ai_true ?? null,
      )
      setIfPresent(
        row,
        'adjudicated_answer_is_ai_true',
        input.adjudication?.adjudicated_answer_is_ai_true ?? row.adjudicated_answer_is_ai_true ?? null,
      )
      setIfPresent(
        row,
        'adjudicated_initiation_type_true',
        input.adjudication?.adjudicated_initiation_type_true ?? row.adjudicated_initiation_type_true ?? null,
      )
      row.notes = (input.adjudication?.notes as string | undefined) ?? row.notes ?? null
      break
    }
  }

  return row
}
