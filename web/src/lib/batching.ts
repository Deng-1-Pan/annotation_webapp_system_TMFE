import type { SingleOnlyCandidate } from '../types/core'

export interface AllocateBatchInput {
  batchSize: number
  currentUserId: string
  singleOnlyCandidates: SingleOnlyCandidate[]
  zeroCandidates: string[]
  alreadyDoubleAnnotated: string[]
  currentUserAnnotatedSampleIds: string[]
}

export interface AllocateBatchResult {
  assignedSampleIds: string[]
  toDoubleCount: number
  newItemCount: number
}

/** Fisher-Yates shuffle (in-place, returns same array). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function allocateBatch(input: AllocateBatchInput): AllocateBatchResult {
  if (!Number.isFinite(input.batchSize) || input.batchSize <= 0) {
    throw new Error('Invalid batch size')
  }
  const limit = Math.min(20, Math.floor(input.batchSize))
  const blocked = new Set([
    ...input.alreadyDoubleAnnotated,
    ...input.currentUserAnnotatedSampleIds,
  ])

  // Shuffle candidates so each batch gets a random subset instead of
  // always picking the first N items in insertion order.
  const shuffledSingle = shuffle([...input.singleOnlyCandidates])
  const shuffledZero = shuffle([...input.zeroCandidates])

  const toDouble: string[] = []
  for (const item of shuffledSingle) {
    if (toDouble.length >= limit) break
    if (blocked.has(item.sampleId)) continue
    if (item.annotatedUserIds.includes(input.currentUserId)) continue
    blocked.add(item.sampleId)
    toDouble.push(item.sampleId)
  }

  const fresh: string[] = []
  for (const sampleId of shuffledZero) {
    if (toDouble.length + fresh.length >= limit) break
    if (blocked.has(sampleId)) continue
    blocked.add(sampleId)
    fresh.push(sampleId)
  }

  return {
    assignedSampleIds: [...toDouble, ...fresh],
    toDoubleCount: toDouble.length,
    newItemCount: fresh.length,
  }
}
