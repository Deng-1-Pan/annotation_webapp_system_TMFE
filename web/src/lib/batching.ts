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

export function allocateBatch(input: AllocateBatchInput): AllocateBatchResult {
  const limit = Math.max(5, Math.min(20, input.batchSize))
  const blocked = new Set([
    ...input.alreadyDoubleAnnotated,
    ...input.currentUserAnnotatedSampleIds,
  ])

  const toDouble: string[] = []
  for (const item of input.singleOnlyCandidates) {
    if (toDouble.length >= limit) break
    if (blocked.has(item.sampleId)) continue
    if (item.annotatedUserIds.includes(input.currentUserId)) continue
    blocked.add(item.sampleId)
    toDouble.push(item.sampleId)
  }

  const fresh: string[] = []
  for (const sampleId of input.zeroCandidates) {
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
