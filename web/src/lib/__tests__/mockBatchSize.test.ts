import { describe, expect, it } from 'vitest'
import { createMockSeedSnapshot } from '../../test-data/mockSeed'
import { claimBatchInSnapshot } from '../progress'
import type { TaskType } from '../../types/schema'

describe('mock seed supports realistic batch sizes', () => {
  it('can allocate 10 items for each task on a fresh snapshot', () => {
    const tasks: TaskType[] = [
      'ai_sentence_audit',
      'role_audit_qa_turns',
      'qa_boundary_audit_docs',
      'initiation_audit_exchanges',
    ]

    for (const taskType of tasks) {
      const snapshot = createMockSeedSnapshot()
      const batch = claimBatchInSnapshot({
        snapshot,
        taskType,
        userId: 'yichen-hu',
        mode: 'annotator',
        batchSize: 10,
        nowIso: '2026-02-25T12:00:00Z',
      })
      expect(batch.sampleIds.length, `${taskType} assigned count`).toBe(10)
    }
  })
})
