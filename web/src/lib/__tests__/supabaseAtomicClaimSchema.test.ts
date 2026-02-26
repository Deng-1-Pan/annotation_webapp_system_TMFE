import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('supabase atomic claim RPC schema', () => {
  it('defines an atomic batch claim function with a transactional lock', () => {
    const schemaPath = path.resolve(process.cwd(), '..', 'supabase', 'schema.sql')
    const sql = readFileSync(schemaPath, 'utf8')

    expect(sql).toContain('create or replace function claim_batch_atomic')
    expect(sql).toContain('returns jsonb')
    expect(sql).toContain('pg_advisory_xact_lock')
    expect(sql).toContain('insert into claims')
  })
})
