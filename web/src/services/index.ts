import { MockDataService } from './mockDataService'
import { SupabaseDataService } from './supabaseDataService'
import type { DataService } from './types'

const mode = (import.meta.env.VITE_DATA_MODE ?? 'mock').toLowerCase()

let singleton: DataService | null = null

export function getDataService(): DataService {
  if (singleton) return singleton
  singleton = mode === 'supabase' ? new SupabaseDataService() : new MockDataService()
  return singleton
}
