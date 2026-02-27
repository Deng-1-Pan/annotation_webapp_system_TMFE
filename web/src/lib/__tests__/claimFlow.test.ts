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

  expect(view.items).toHaveLength(batch.sampleIds.length)
  expect(new Set(view.items.map((i) => i.taskItem.sampleId))).toEqual(new Set(batch.sampleIds))
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

it('builds a stable item order for the same batch even if claim row order changes between fetches', () => {
  const snapshot = createMockSeedSnapshot()
  const batch = claimBatchInSnapshot({
    snapshot,
    taskType: 'ai_sentence_audit',
    userId: 'weijie-huang',
    mode: 'annotator',
    batchSize: 10,
    nowIso: '2026-02-25T12:00:00Z',
  })

  const firstView = buildBatchView({
    snapshot,
    taskType: 'ai_sentence_audit',
    batchId: batch.batchId,
    userId: 'weijie-huang',
  })
  const firstOrder = firstView.items.map((i) => i.taskItem.sampleId)

  // Simulate DB returning the same batch claims in a different physical row order.
  const batchClaims = snapshot.claims.filter((c) => c.batchId === batch.batchId && c.taskType === 'ai_sentence_audit')
  const others = snapshot.claims.filter((c) => !(c.batchId === batch.batchId && c.taskType === 'ai_sentence_audit'))
  snapshot.claims = [...others, ...batchClaims.reverse()]

  const secondView = buildBatchView({
    snapshot,
    taskType: 'ai_sentence_audit',
    batchId: batch.batchId,
    userId: 'weijie-huang',
  })
  const secondOrder = secondView.items.map((i) => i.taskItem.sampleId)

  expect(secondOrder).toEqual(firstOrder)
})

it('supports two annotators closing out single_only backlog by claiming one item at a time', () => {
  const snapshot = createMockSeedSnapshot()
  const taskType = 'ai_sentence_audit'
  const seededSingleOnlyIds = snapshot.taskItems
    .filter((item) => item.taskType === taskType)
    .slice(0, 8)
    .map((item) => item.sampleId)

  for (const sampleId of seededSingleOnlyIds) {
    saveAnnotationInSnapshot({
      snapshot,
      taskType,
      sampleId,
      user: { id: 'ruohan-zhong', displayName: 'Ruohan Zhong' },
      mode: 'annotator',
      annotation: { is_ai_true: 1, notes: 'seed single-only' },
      nowIso: '2026-02-25T12:00:00Z',
    })
  }

  const closingUsers = [
    { id: 'weijie-huang', displayName: 'Weijie Huang' },
    { id: 'arthur-hsu', displayName: 'Arthur HSU' },
  ]

  let minuteOffset = 1
  let completedByClosers = 0
  for (let round = 0; round < 30; round += 1) {
    let claimedInRound = 0
    for (const user of closingUsers) {
      const nowIso = new Date(Date.UTC(2026, 1, 25, 12, minuteOffset, 0)).toISOString()
      minuteOffset += 1
      const batch = claimBatchInSnapshot({
        snapshot,
        taskType,
        userId: user.id,
        mode: 'annotator',
        batchSize: 1,
        nowIso,
      })

      const sampleId = batch.sampleIds[0]
      if (!sampleId) continue
      claimedInRound += 1
      completedByClosers += 1
      saveAnnotationInSnapshot({
        snapshot,
        taskType,
        sampleId,
        user,
        mode: 'annotator',
        annotation: { is_ai_true: 0, notes: `closed by ${user.id}` },
        batchId: batch.batchId,
        nowIso,
      })
    }
    if (claimedInRound === 0) break
  }

  expect(completedByClosers).toBeGreaterThanOrEqual(seededSingleOnlyIds.length)

  for (const sampleId of seededSingleOnlyIds) {
    const distinctFormalUsers = new Set(
      snapshot.annotations
        .filter((ann) => ann.taskType === taskType && ann.sampleId === sampleId && ann.mode === 'annotator')
        .map((ann) => ann.userId),
    )
    expect(distinctFormalUsers.size).toBeGreaterThanOrEqual(2)
  }
})
