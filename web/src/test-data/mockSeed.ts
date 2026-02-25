import { APP_USERS, DEFAULT_TASK_CONFIGS } from '../config/defaults'
import type {
  DataStoreSnapshot,
  TaskItemRecord,
  TranscriptDocContext,
  AnnotationRecordNormalized,
  AdjudicationRecordNormalized,
} from '../types/schema'

const now = '2026-02-25T12:00:00Z'

const transcriptContexts: Record<string, TranscriptDocContext> = {
  'ROL_2025Q1': {
    docId: 'ROL_2025Q1',
    ticker: 'ROL',
    year: 2025,
    quarter: 1,
    speechTurns: [
      { idx: 0, speaker: 'Operator', text: 'Welcome to the call.', role: 'operator', section: 'speech' },
      { idx: 1, speaker: 'CEO', text: 'Opening remarks on business and AI investments.', role: 'management', section: 'speech' },
    ],
    qaTurns: [
      { idx: 70, speaker: 'Operator', text: 'Next question from Stephanie Moore.', role: 'operator', section: 'qa' },
      { idx: 71, speaker: 'Stephanie Moore', text: 'Question about M&A environment and AI strategy.', role: 'analyst', isQuestion: true, section: 'qa' },
      { idx: 72, speaker: 'CEO', text: 'Response on deal pipeline and AI roadmap.', role: 'management', isQuestion: false, section: 'qa' },
      { idx: 73, speaker: 'Operator', text: 'Next question please.', role: 'operator', section: 'qa' },
    ],
    mergedTurns: [
      { idx: 0, speaker: 'Operator', text: 'Welcome to the call.', role: 'operator', section: 'speech' },
      { idx: 1, speaker: 'CEO', text: 'Opening remarks on business and AI investments.', role: 'management', section: 'speech' },
      { idx: 70, speaker: 'Operator', text: 'Next question from Stephanie Moore.', role: 'operator', section: 'qa' },
      { idx: 71, speaker: 'Stephanie Moore', text: 'Question about M&A environment and AI strategy.', role: 'analyst', isQuestion: true, section: 'qa' },
      { idx: 72, speaker: 'CEO', text: 'Response on deal pipeline and AI roadmap.', role: 'management', section: 'qa' },
    ],
  },
  'ULTA_2023Q2': {
    docId: 'ULTA_2023Q2',
    ticker: 'ULTA',
    year: 2023,
    quarter: 2,
    speechTurns: [
      { idx: 0, speaker: 'Operator', text: 'Good afternoon and welcome...', role: 'operator', section: 'speech' },
      { idx: 1, speaker: 'David Kimbell', text: 'Prepared remarks and store performance...', role: 'management', section: 'speech' },
    ],
    qaTurns: [
      { idx: 2, speaker: 'Analyst A', text: 'Question on demand trends...', role: 'analyst', isQuestion: true, section: 'qa' },
      { idx: 3, speaker: 'David Kimbell', text: 'Answer on demand trends...', role: 'management', isQuestion: false, section: 'qa' },
    ],
    mergedTurns: [
      { idx: 0, speaker: 'Operator', text: 'Good afternoon and welcome...', role: 'operator', section: 'speech' },
      { idx: 1, speaker: 'David Kimbell', text: 'Prepared remarks and store performance...', role: 'management', section: 'speech' },
      { idx: 2, speaker: 'Analyst A', text: 'Question on demand trends...', role: 'analyst', isQuestion: true, section: 'qa' },
      { idx: 3, speaker: 'David Kimbell', text: 'Answer on demand trends...', role: 'management', section: 'qa' },
    ],
  },
  'EPAM_2024Q2': {
    docId: 'EPAM_2024Q2',
    ticker: 'EPAM',
    year: 2024,
    quarter: 2,
    speechTurns: [],
    qaTurns: [
      { idx: 13, speaker: 'Analyst', text: 'Question about GenAI demand timing?', role: 'analyst', isQuestion: true, section: 'qa' },
      { idx: 14, speaker: 'Management', text: 'Answer pivots into GenAI transformation demand...', role: 'management', isQuestion: false, section: 'qa' },
    ],
    mergedTurns: [
      { idx: 13, speaker: 'Analyst', text: 'Question about GenAI demand timing?', role: 'analyst', isQuestion: true, section: 'qa' },
      { idx: 14, speaker: 'Management', text: 'Answer pivots into GenAI transformation demand...', role: 'management', isQuestion: false, section: 'qa' },
    ],
  },
  'IRM_2023Q1': {
    docId: 'IRM_2023Q1',
    ticker: 'IRM',
    year: 2023,
    quarter: 1,
    speechTurns: [],
    qaTurns: [],
    mergedTurns: [],
  },
}

const taskItems: TaskItemRecord[] = [
  {
    id: 'ti-ai-1',
    taskType: 'ai_sentence_audit',
    sampleId: 'AI_SENT_0001',
    docId: 'IRM_2023Q1',
    createdAt: now,
    payload: {
      sample_id: 'AI_SENT_0001',
      doc_id: 'IRM_2023Q1',
      section: 'speech',
      text: 'As we projected, data center services were down year-on-year...',
      kw_is_ai_pred: 1,
      annotator_a_is_ai_true: null,
      annotator_b_is_ai_true: null,
      adjudicated_is_ai_true: null,
      false_positive_type: null,
      notes: null,
    },
  },
  {
    id: 'ti-ai-2',
    taskType: 'ai_sentence_audit',
    sampleId: 'AI_SENT_0002',
    docId: 'IRM_2023Q1',
    createdAt: now,
    payload: {
      sample_id: 'AI_SENT_0002',
      doc_id: 'IRM_2023Q1',
      section: 'qa',
      text: 'We are investing in AI-enabled automation for customer support.',
      kw_is_ai_pred: 1,
      annotator_a_is_ai_true: null,
      annotator_b_is_ai_true: null,
      adjudicated_is_ai_true: null,
      false_positive_type: null,
      notes: null,
    },
  },
  {
    id: 'ti-role-1',
    taskType: 'role_audit_qa_turns',
    sampleId: 'ROLE_0001',
    docId: 'ROL_2025Q1',
    createdAt: now,
    payload: {
      sample_id: 'ROLE_0001',
      doc_id: 'ROL_2025Q1',
      turn_idx: 71,
      speaker: 'Stephanie Moore',
      text: 'Question about M&A strategy in a challenging environment.',
      role_pred: 'analyst',
      turn_kw_is_ai_pred: 0,
      n_sentences_in_turn: 2,
      annotator_a_role_true: null,
      annotator_b_role_true: null,
      adjudicated_role_true: null,
      notes: null,
    },
  },
  {
    id: 'ti-role-2',
    taskType: 'role_audit_qa_turns',
    sampleId: 'ROLE_0002',
    docId: 'ROL_2025Q1',
    createdAt: now,
    payload: {
      sample_id: 'ROLE_0002',
      doc_id: 'ROL_2025Q1',
      turn_idx: 70,
      speaker: 'Operator',
      text: 'Next question from Stephanie Moore.',
      role_pred: 'unknown',
      turn_kw_is_ai_pred: 0,
      n_sentences_in_turn: 1,
      annotator_a_role_true: null,
      annotator_b_role_true: null,
      adjudicated_role_true: null,
      notes: null,
    },
  },
  {
    id: 'ti-bound-1',
    taskType: 'qa_boundary_audit_docs',
    sampleId: 'BOUND_0001',
    docId: 'ULTA_2023Q2',
    createdAt: now,
    payload: {
      sample_id: 'BOUND_0001',
      doc_id: 'ULTA_2023Q2',
      ticker: 'ULTA',
      year: 2023,
      quarter: 2,
      overall_kw_ai_ratio: 0,
      speech_kw_ai_ratio: 0,
      qa_kw_ai_ratio: 0,
      speech_turn_count_pred: 1,
      qa_turn_count_pred: 45,
      num_qa_exchanges_pred_parser: 13,
      speech_tail_preview: 'Operator: Good afternoon, and welcome...',
      qa_head_preview: 'Kiley Rawlins: Thanks, Paul...',
      annotator_a_boundary_correct: null,
      annotator_b_boundary_correct: null,
      adjudicated_boundary_correct: null,
      annotator_a_pairing_quality: null,
      annotator_b_pairing_quality: null,
      adjudicated_pairing_quality: null,
      notes: null,
    },
  },
  {
    id: 'ti-bound-2',
    taskType: 'qa_boundary_audit_docs',
    sampleId: 'BOUND_0002',
    docId: 'ULTA_2023Q2',
    createdAt: now,
    payload: {
      sample_id: 'BOUND_0002',
      doc_id: 'ULTA_2023Q2',
      ticker: 'ULTA',
      year: 2023,
      quarter: 2,
      overall_kw_ai_ratio: 0.1,
      speech_kw_ai_ratio: 0,
      qa_kw_ai_ratio: 0.2,
      speech_turn_count_pred: 2,
      qa_turn_count_pred: 10,
      num_qa_exchanges_pred_parser: 4,
      speech_tail_preview: 'Prepared remarks end...',
      qa_head_preview: 'Analyst starts Q&A...',
      annotator_a_boundary_correct: null,
      annotator_b_boundary_correct: null,
      adjudicated_boundary_correct: null,
      annotator_a_pairing_quality: null,
      annotator_b_pairing_quality: null,
      adjudicated_pairing_quality: null,
      notes: null,
    },
  },
  {
    id: 'ti-init-1',
    taskType: 'initiation_audit_exchanges',
    sampleId: 'INIT_0001',
    docId: 'EPAM_2024Q2',
    createdAt: now,
    payload: {
      sample_id: 'INIT_0001',
      doc_id: 'EPAM_2024Q2',
      exchange_idx: 7,
      questioner: 'Arkadiy Dobkin',
      answerer: 'Surinder Thind',
      question_text: 'When you say it will be stable, what do you mean?',
      answer_text: '...make the progress of GenAI transformation much more real...',
      question_is_ai_pred: 0,
      answer_is_ai_pred: 1,
      initiation_type_pred: 'management_pivot',
      annotator_a_question_is_ai_true: null,
      annotator_b_question_is_ai_true: null,
      adjudicated_question_is_ai_true: null,
      annotator_a_answer_is_ai_true: null,
      annotator_b_answer_is_ai_true: null,
      adjudicated_answer_is_ai_true: null,
      annotator_a_initiation_type_true: null,
      annotator_b_initiation_type_true: null,
      adjudicated_initiation_type_true: null,
      notes: null,
    },
  },
  {
    id: 'ti-init-2',
    taskType: 'initiation_audit_exchanges',
    sampleId: 'INIT_0002',
    docId: 'EPAM_2024Q2',
    createdAt: now,
    payload: {
      sample_id: 'INIT_0002',
      doc_id: 'EPAM_2024Q2',
      exchange_idx: 8,
      questioner: 'Analyst',
      answerer: 'Management',
      question_text: 'How are AI projects affecting margin now?',
      answer_text: 'AI demand remains early but expanding.',
      question_is_ai_pred: 1,
      answer_is_ai_pred: 1,
      initiation_type_pred: 'analyst_initiated',
      annotator_a_question_is_ai_true: null,
      annotator_b_question_is_ai_true: null,
      adjudicated_question_is_ai_true: null,
      annotator_a_answer_is_ai_true: null,
      annotator_b_answer_is_ai_true: null,
      adjudicated_answer_is_ai_true: null,
      annotator_a_initiation_type_true: null,
      annotator_b_initiation_type_true: null,
      adjudicated_initiation_type_true: null,
      notes: null,
    },
  },
]

function pad4(n: number) {
  return String(n).padStart(4, '0')
}

function expandMockTaskItems(minPerTaskByTask?: Partial<Record<TaskItemRecord['taskType'], number>>): TaskItemRecord[] {
  const defaultMinByTask: Record<TaskItemRecord['taskType'], number> = {
    ai_sentence_audit: 18,
    role_audit_qa_turns: 14,
    qa_boundary_audit_docs: 12,
    initiation_audit_exchanges: 16,
  }
  const minByTask = { ...defaultMinByTask, ...(minPerTaskByTask ?? {}) }
  const byTask = new Map<string, TaskItemRecord[]>() as Map<TaskItemRecord['taskType'], TaskItemRecord[]>
  for (const item of taskItems) {
    const list = byTask.get(item.taskType) ?? []
    list.push(item)
    byTask.set(item.taskType, list)
  }

  const expanded = [...taskItems]

  for (const [taskType, seeds] of byTask.entries()) {
    const minPerTask = minByTask[taskType]
    for (let i = seeds.length + 1; i <= minPerTask; i++) {
      const template = structuredClone(seeds[(i - 1) % seeds.length])
      let sampleId = ''
      if (taskType === 'ai_sentence_audit') sampleId = `AI_SENT_${pad4(i)}`
      if (taskType === 'role_audit_qa_turns') sampleId = `ROLE_${pad4(i)}`
      if (taskType === 'qa_boundary_audit_docs') sampleId = `BOUND_${pad4(i)}`
      if (taskType === 'initiation_audit_exchanges') sampleId = `INIT_${pad4(i)}`

      template.id = `ti-${taskType}-${sampleId}`
      template.sampleId = sampleId
      ;(template.payload as unknown as Record<string, unknown>).sample_id = sampleId

      if (taskType === 'role_audit_qa_turns') {
        ;(template.payload as unknown as Record<string, unknown>).turn_idx = 70 + i
        ;(template.payload as unknown as Record<string, unknown>).speaker =
          i % 3 === 0 ? 'Operator' : i % 2 === 0 ? 'Management Speaker' : 'Analyst Speaker'
        ;(template.payload as unknown as Record<string, unknown>).text = `Mock role audit turn ${i} in the earnings call transcript.`
      }

      if (taskType === 'qa_boundary_audit_docs') {
        ;(template.payload as unknown as Record<string, unknown>).speech_tail_preview = `Mock speech tail preview ${i} ...`
        ;(template.payload as unknown as Record<string, unknown>).qa_head_preview = `Mock qa head preview ${i} ...`
        ;(template.payload as unknown as Record<string, unknown>).num_qa_exchanges_pred_parser = 3 + (i % 10)
      }

      if (taskType === 'initiation_audit_exchanges') {
        ;(template.payload as unknown as Record<string, unknown>).exchange_idx = i
        ;(template.payload as unknown as Record<string, unknown>).question_text = `Mock analyst question ${i} about AI demand.`
        ;(template.payload as unknown as Record<string, unknown>).answer_text = `Mock management answer ${i} about AI pipeline and rollout.`
      }

      if (taskType === 'ai_sentence_audit') {
        ;(template.payload as unknown as Record<string, unknown>).text = `Mock sentence ${i} mentioning automation and AI-related wording.`
        ;(template.payload as unknown as Record<string, unknown>).section = i % 2 === 0 ? 'qa' : 'speech'
      }

      expanded.push(template)
    }
  }

  return expanded
}

const annotations: AnnotationRecordNormalized[] = [
  {
    id: 'ann-1',
    taskType: 'role_audit_qa_turns',
    sampleId: 'ROLE_0001',
    userId: 'arthur-hsu',
    userName: 'Arthur HSU',
    mode: 'annotator',
    annotation: { role_true: 'analyst', notes: 'Looks like analyst question' },
    submittedAt: '2026-02-25T10:00:00Z',
  },
  {
    id: 'ann-2',
    taskType: 'initiation_audit_exchanges',
    sampleId: 'INIT_0001',
    userId: 'weijie-huang',
    userName: 'Weijie Huang',
    mode: 'annotator',
    annotation: {
      question_is_ai_true: 0,
      answer_is_ai_true: 1,
      initiation_type_true: 'management_pivot',
      notes: 'Answer introduces GenAI',
    },
    submittedAt: '2026-02-25T10:05:00Z',
  },
  {
    id: 'ann-3',
    taskType: 'initiation_audit_exchanges',
    sampleId: 'INIT_0001',
    userId: 'ruohan-zhong',
    userName: 'Ruohan Zhong',
    mode: 'annotator',
    annotation: {
      question_is_ai_true: 0,
      answer_is_ai_true: 1,
      initiation_type_true: 'analyst_initiated',
      notes: 'I think question implies AI follow-up',
    },
    submittedAt: '2026-02-25T10:06:00Z',
  },
  {
    id: 'ann-4',
    taskType: 'ai_sentence_audit',
    sampleId: 'AI_SENT_0001',
    userId: 'deng-pan',
    userName: 'Deng Pan',
    mode: 'test',
    annotation: { is_ai_true: 0, false_positive_type: 'data_center_generic', notes: 'test submission' },
    submittedAt: '2026-02-25T10:07:00Z',
  },
]

const adjudications: AdjudicationRecordNormalized[] = [
  {
    id: 'adj-1',
    taskType: 'role_audit_qa_turns',
    sampleId: 'ROLE_0001',
    adjudicated: { adjudicated_role_true: 'analyst' },
    notes: 'Matches A',
    adjudicatedBy: 'deng-pan',
    adjudicatedAt: '2026-02-25T11:00:00Z',
    autoFilled: true,
  },
]

export function createMockSeedSnapshot(): DataStoreSnapshot {
  return {
    users: structuredClone(APP_USERS),
    taskConfigs: structuredClone(DEFAULT_TASK_CONFIGS),
    taskItems: structuredClone(expandMockTaskItems()),
    transcriptContexts: structuredClone(transcriptContexts),
    claims: [],
    annotations: structuredClone(annotations),
    adjudications: structuredClone(adjudications),
  }
}
