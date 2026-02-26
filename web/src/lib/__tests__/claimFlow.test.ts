import { expect, it, vi } from 'vitest'
import { createMockSeedSnapshot } from '../../test-data/mockSeed'
import { buildBatchView, claimBatchInSnapshot, saveAnnotationInSnapshot } from '../progress'

it('marks claims submitted after saving and does not block claiming a different task', () => {
  const snapshot = createMockSeedSnapshot()

  const aiBatch = claimBatchInSnapshot({
    snapshot,
    taskType: 'ai_sentence_audit',
    userId: 'weijie-huang',
    mode: 'annotator',
    batchSize: 10,
    nowIso: '2026-02-25T12:00:00Z',
  })

  expect(aiBatch.sampleIds.length).toBeGreaterThan(0)

  for (const sampleId of aiBatch.sampleIds) {
    saveAnnotationInSnapshot({
      snapshot,
      taskType: 'ai_sentence_audit',
      sampleId,
      user: { id: 'weijie-huang', displayName: 'Weijie Huang' },
      mode: 'annotator',
      annotation: { is_ai_true: 1, notes: 'done' },
      batchId: aiBatch.batchId,
      nowIso: '2026-02-25T12:01:00Z',
    })
  }

  expect(
    snapshot.claims.filter((c) => c.batchId === aiBatch.batchId && c.status === 'claimed').length,
  ).toBe(0)

  const roleBatch = claimBatchInSnapshot({
    snapshot,
    taskType: 'role_audit_qa_turns',
    userId: 'weijie-huang',
    mode: 'annotator',
    batchSize: 10,
    nowIso: '2026-02-25T12:02:00Z',
  })

  expect(roleBatch.sampleIds.length).toBeGreaterThan(0)
})

it('deduplicates duplicate claims for the same sample within one batch when building batch view', () => {
  const snapshot = createMockSeedSnapshot()
  const batch = claimBatchInSnapshot({
    snapshot,
    taskType: 'ai_sentence_audit',
    userId: 'weijie-huang',
    mode: 'annotator',
    batchSize: 5,
    nowIso: '2026-02-25T12:00:00Z',
  })

  expect(batch.sampleIds.length).toBeGreaterThan(0)
  const duplicatedSampleId = batch.sampleIds[0]
  const originalClaim = snapshot.claims.find(
    (c) => c.batchId === batch.batchId && c.taskType === 'ai_sentence_audit' && c.sampleId === duplicatedSampleId,
  )
  expect(originalClaim).toBeDefined()

  snapshot.claims.push({
    ...originalClaim!,
    id: `${originalClaim!.id}-dup`,
  })

  const view = buildBatchView({
    snapshot,
    taskType: 'ai_sentence_audit',
    batchId: batch.batchId,
    userId: 'weijie-huang',
  })

  expect(view.items.map((i) => i.taskItem.sampleId)).toEqual(batch.sampleIds)
})

it('generates distinct batch ids for same-task claims created in the same millisecond', () => {
  const snapshot = createMockSeedSnapshot()
  const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
  const randSpy = vi.spyOn(Math, 'random')
    .mockReturnValueOnce(0.111111111)
    .mockReturnValueOnce(0.222222222)

  try {
    const first = claimBatchInSnapshot({
      snapshot,
      taskType: 'ai_sentence_audit',
      userId: 'weijie-huang',
      mode: 'annotator',
      batchSize: 5,
      nowIso: '2026-02-25T12:00:00Z',
    })
    const second = claimBatchInSnapshot({
      snapshot,
      taskType: 'ai_sentence_audit',
      userId: 'weijie-huang',
      mode: 'annotator',
      batchSize: 5,
      nowIso: '2026-02-25T12:00:00Z',
    })

    expect(first.batchId).not.toBe(second.batchId)
  } finally {
    randSpy.mockRestore()
    nowSpy.mockRestore()
  }
})
