import { expect, it } from 'vitest'
import { buildDoubleAnnotatedExportRow } from '../exportPivot'

it('maps first two formal annotations into A/B slots and keeps adjudicated fields', () => {
  const row = buildDoubleAnnotatedExportRow({
    taskType: 'role_audit_qa_turns',
    baseRow: {
      sample_id: 'ROLE_0001',
      doc_id: 'DOC1',
      turn_idx: 5,
      speaker: 'Alice',
      text: 'hello',
      role_pred: 'unknown',
      turn_kw_is_ai_pred: 0,
      n_sentences_in_turn: 1,
      annotator_a_role_true: null,
      annotator_b_role_true: null,
      adjudicated_role_true: null,
      notes: null,
    },
    formalAnnotations: [
      {
        id: 'ann-2',
        userName: 'Yichen Hu',
        submittedAt: '2026-02-25T10:00:01Z',
        annotation: { role_true: 'management', notes: 'A note' },
      },
      {
        id: 'ann-1',
        userName: 'Arthur HSU',
        submittedAt: '2026-02-25T10:00:00Z',
        annotation: { role_true: 'analyst', notes: 'B note' },
      },
      {
        id: 'ann-3',
        userName: 'Deng Pan',
        submittedAt: '2026-02-25T10:00:02Z',
        annotation: { role_true: 'operator', notes: 'ignored extra' },
      },
    ],
    adjudication: {
      adjudicated_role_true: 'management',
      notes: 'final note',
    },
  })

  expect(row.annotator_a_role_true).toBe('analyst')
  expect(row.annotator_b_role_true).toBe('management')
  expect(row.adjudicated_role_true).toBe('management')
  expect(row.notes).toBe('final note')
})
