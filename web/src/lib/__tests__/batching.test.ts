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

    expect(result.assignedSampleIds).toEqual(['S1', 'S3', 'Z1', 'Z2', 'Z3'])
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

    expect(result.assignedSampleIds).toEqual(['S4', 'Z1'])
    expect(result.toDoubleCount).toBe(1)
    expect(result.newItemCount).toBe(1)
  })
})
