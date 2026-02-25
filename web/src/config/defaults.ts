import type { AppUser, TaskConfig, TaskType } from '../types/schema'

export const APP_USERS: AppUser[] = [
  { id: 'weijie-huang', displayName: 'Weijie Huang', isTestUser: false, canAdjudicate: false, isActive: true },
  { id: 'arthur-hsu', displayName: 'Arthur HSU', isTestUser: false, canAdjudicate: false, isActive: true },
  { id: 'yichen-hu', displayName: 'Yichen Hu', isTestUser: false, canAdjudicate: false, isActive: true },
  { id: 'ruohan-zhong', displayName: 'Ruohan Zhong', isTestUser: false, canAdjudicate: false, isActive: true },
  { id: 'deng-pan', displayName: 'Deng Pan', isTestUser: true, canAdjudicate: true, isActive: true },
]

export const TASK_ORDER: TaskType[] = [
  'ai_sentence_audit',
  'role_audit_qa_turns',
  'qa_boundary_audit_docs',
  'initiation_audit_exchanges',
]

export const DEFAULT_TASK_CONFIGS: TaskConfig[] = [
  {
    taskType: 'ai_sentence_audit',
    displayName: 'AI句子识别审计',
    description: '验证关键词法是否误判/漏判。',
    targetTotalCompleted: 120,
    excludeTestByDefault: true,
    batchStrategy: 'auto_mixed',
  },
  {
    taskType: 'role_audit_qa_turns',
    displayName: 'Q&A角色识别审计',
    description: '结合上下文核对 analyst / management / operator / unknown。',
    targetTotalCompleted: 80,
    targetMinPerLabel: 20,
    coverageLabels: ['analyst', 'management', 'operator', 'unknown'],
    excludeTestByDefault: true,
    batchStrategy: 'auto_mixed',
  },
  {
    taskType: 'qa_boundary_audit_docs',
    displayName: 'Q&A边界与配对质量',
    description: '检查 speech/qa 切分与 pairing 质量。',
    targetTotalCompleted: 40,
    excludeTestByDefault: true,
    batchStrategy: 'auto_mixed',
  },
  {
    taskType: 'initiation_audit_exchanges',
    displayName: 'AI Initiation 审计',
    description: '判断问题/回答是否AI相关及谁先引出AI。',
    targetTotalCompleted: 80,
    targetMinPerLabel: 20,
    coverageLabels: ['analyst_initiated', 'management_pivot', 'analyst_only', 'non_ai'],
    excludeTestByDefault: true,
    batchStrategy: 'auto_mixed',
  },
]

export const CLAIM_TTL_MINUTES = 60
