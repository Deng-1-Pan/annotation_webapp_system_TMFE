import { describe, expect, it } from 'vitest'
import { allocateBatch } from '../batching'

describe('allocateBatch', () => {
  it('prioritizes single-only items and avoids items already annotated by current user', () => {
    const result = allocateBatch({
      batchSize: 5,
      currentUserId: 'u1',
      singleOnlyCandidates: [
        { sampleId: 'S1', annotatedUserIds: ['u2'] },
        { sampleId: 'S2', annotatedUserIds: ['u1'] },
        { sampleId: 'S3', annotatedUserIds: ['u3'] },
      ],
      zeroCandidates: ['Z1', 'Z2', 'Z3'],
      alreadyDoubleAnnotated: ['D1'],
      currentUserAnnotatedSampleIds: ['S2', 'Z9'],
    })

    // S2 is excluded (annotated by u1), S1 and S3 go to toDouble, rest from zeroCandidates.
    // Order is randomized, so check set membership instead of exact order.
    expect(new Set(result.assignedSampleIds)).toEqual(new Set(['S1', 'S3', 'Z1', 'Z2', 'Z3']))
    expect(result.toDoubleCount).toBe(2)
    expect(result.newItemCount).toBe(3)
  })

  it('never allocates double-annotated items and truncates to requested batch size', () => {
    const result = allocateBatch({
      batchSize: 2,
      currentUserId: 'u4',
      singleOnlyCandidates: [
        { sampleId: 'D1', annotatedUserIds: ['u2'] },
        { sampleId: 'S4', annotatedUserIds: ['u2'] },
      ],
      zeroCandidates: ['Z1'],
      alreadyDoubleAnnotated: ['D1'],
      currentUserAnnotatedSampleIds: [],
    })

    expect(new Set(result.assignedSampleIds)).toEqual(new Set(['S4', 'Z1']))
    expect(result.toDoubleCount).toBe(1)
    expect(result.newItemCount).toBe(1)
  })

  it('returns unique sampleIds even when called multiple times', () => {
    for (let trial = 0; trial < 10; trial++) {
      const result = allocateBatch({
        batchSize: 5,
        currentUserId: 'u1',
        singleOnlyCandidates: [],
        zeroCandidates: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        alreadyDoubleAnnotated: [],
        currentUserAnnotatedSampleIds: [],
      })

      expect(result.assignedSampleIds.length).toBe(5)
      expect(new Set(result.assignedSampleIds).size).toBe(5) // all unique
      for (const id of result.assignedSampleIds) {
        expect(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']).toContain(id)
      }
    }
  })

  it('respects requested batch size when it is below 5 (used for final remainder allocation)', () => {
    const result = allocateBatch({
      batchSize: 3,
      currentUserId: 'u1',
      singleOnlyCandidates: [],
      zeroCandidates: ['A', 'B', 'C', 'D', 'E'],
      alreadyDoubleAnnotated: [],
      currentUserAnnotatedSampleIds: [],
    })

    expect(result.assignedSampleIds.length).toBe(3)
    expect(new Set(result.assignedSampleIds).size).toBe(3)
  })

  it('throws for non-positive batch size', () => {
    expect(() =>
      allocateBatch({
        batchSize: 0,
        currentUserId: 'u1',
        singleOnlyCandidates: [],
        zeroCandidates: ['A', 'B', 'C'],
        alreadyDoubleAnnotated: [],
        currentUserAnnotatedSampleIds: [],
      }),
    ).toThrow('Invalid batch size')
  })
})
