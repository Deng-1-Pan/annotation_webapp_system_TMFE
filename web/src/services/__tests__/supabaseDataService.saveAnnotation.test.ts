import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseDataService } from '../supabaseDataService'

type DbRow = Record<string, unknown>
type DbResult = { data: DbRow[] | DbRow | null; error: { message: string } | null }

const { mockClient, mockState } = vi.hoisted(() => {
  const state = {
    appUser: { id: 'user-a' } as DbRow,
    existingAnnotationRows: [] as DbRow[],
    upsertError: null as { message: string } | null,
    updateClaimsError: null as { message: string } | null,
    upsertCalls: [] as Array<{ payload: DbRow; onConflict: string }>,
  }
  return {
    mockClient: {
      from: vi.fn(),
    },
    mockState: state,
  }
})

vi.mock('../supabaseClient', () => ({
  hasSupabaseEnv: true,
  supabase: mockClient,
}))

function makeAwaitableQuery(result: DbResult) {
  const chain: {
    eq: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: DbResult) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    eq: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  chain.eq.mockReturnValue(chain)
  return chain
}

describe('SupabaseDataService.saveAnnotation', () => {
  const service = new SupabaseDataService()

  beforeEach(() => {
    mockState.appUser = { id: 'user-a' }
    mockState.existingAnnotationRows = []
    mockState.upsertError = null
    mockState.updateClaimsError = null
    mockState.upsertCalls = []

    mockClient.from.mockImplementation((table: string) => {
      if (table === 'app_users') {
        const chain = {
          eq: vi.fn(),
          single: vi.fn(async () => ({ data: mockState.appUser, error: null })),
        }
        chain.eq.mockReturnValue(chain)
        return {
          select: vi.fn(() => chain),
        }
      }

      if (table === 'annotations') {
        return {
          select: vi.fn(() => makeAwaitableQuery({ data: mockState.existingAnnotationRows, error: null })),
          upsert: vi.fn(async (payload: DbRow, opts: { onConflict: string }) => {
            mockState.upsertCalls.push({ payload, onConflict: opts.onConflict })
            return { error: mockState.upsertError }
          }),
        }
      }

      if (table === 'claims') {
        return {
          update: vi.fn(() => makeAwaitableQuery({ data: null, error: mockState.updateClaimsError })),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    })
  })

  it('blocks stale submission when sample already has two distinct annotators excluding current user', async () => {
    mockState.existingAnnotationRows = [{ user_id: 'user-b' }, { user_id: 'user-c' }]

    await expect(
      service.saveAnnotation({
        session: { userId: 'user-a', mode: 'annotator' },
        taskType: 'ai_sentence_audit',
        sampleId: 's-001',
        batchId: 'batch-1',
        annotation: { is_ai_true: 1, notes: 'late submit' },
      }),
    ).rejects.toThrow('提交已被拦截：由于超时，该任务已被其他两位成员完成。')

    expect(mockState.upsertCalls).toHaveLength(0)
  })

  it('allows overwrite when current user is already one of the existing annotators', async () => {
    mockState.existingAnnotationRows = [{ user_id: 'user-a' }, { user_id: 'user-b' }]

    await expect(
      service.saveAnnotation({
        session: { userId: 'user-a', mode: 'annotator' },
        taskType: 'ai_sentence_audit',
        sampleId: 's-001',
        batchId: 'batch-1',
        annotation: { is_ai_true: 0, notes: 'update own answer' },
      }),
    ).resolves.toBeUndefined()

    expect(mockState.upsertCalls).toHaveLength(1)
  })

  it('allows submission when only one distinct annotator exists', async () => {
    mockState.existingAnnotationRows = [{ user_id: 'user-b' }]

    await expect(
      service.saveAnnotation({
        session: { userId: 'user-a', mode: 'annotator' },
        taskType: 'ai_sentence_audit',
        sampleId: 's-001',
        batchId: 'batch-1',
        annotation: { is_ai_true: 1, notes: 'second annotator' },
      }),
    ).resolves.toBeUndefined()

    expect(mockState.upsertCalls).toHaveLength(1)
  })
})
