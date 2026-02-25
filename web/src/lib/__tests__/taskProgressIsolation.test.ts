import { describe, expect, it } from 'vitest'
import { createMockSeedSnapshot } from '../../test-data/mockSeed'
import { DEFAULT_TASK_CONFIGS } from '../../config/defaults'
import { computeAllTaskProgress } from '../progress'

describe('task progress isolation', () => {
  it('computes task progress per task instead of one global aggregate', () => {
    const snapshot = createMockSeedSnapshot()
    const summaries = computeAllTaskProgress(snapshot, DEFAULT_TASK_CONFIGS, {
      includeTestUserData: false,
      nowIso: '2026-02-25T12:00:00Z',
    })
    const byTask = Object.fromEntries(summaries.map((s) => [s.taskType, s]))

    expect(byTask.ai_sentence_audit.singleAnnotatedCount).toBe(0)
    expect(byTask.role_audit_qa_turns.singleAnnotatedCount).toBe(1)
    expect(byTask.qa_boundary_audit_docs.singleAnnotatedCount).toBe(0)
    expect(byTask.initiation_audit_exchanges.doubleAnnotatedCount).toBe(1)
    expect(byTask.ai_sentence_audit.totalItems).toBe(18)
    expect(byTask.role_audit_qa_turns.totalItems).toBe(14)
    expect(byTask.qa_boundary_audit_docs.totalItems).toBe(12)
    expect(byTask.initiation_audit_exchanges.totalItems).toBe(16)
  })
})
