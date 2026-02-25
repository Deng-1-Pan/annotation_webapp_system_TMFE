import { DEFAULT_TASK_CONFIGS, TASK_ORDER } from '../config/defaults'
import type { TaskType } from '../types/schema'

export function isTaskType(value: string | undefined): value is TaskType {
  return Boolean(value && TASK_ORDER.includes(value as TaskType))
}

export function mustTaskType(value: string | undefined): TaskType {
  if (!isTaskType(value)) {
    throw new Error(`Unknown task type: ${value ?? 'undefined'}`)
  }
  return value
}

export function taskDisplayName(taskType: TaskType) {
  return DEFAULT_TASK_CONFIGS.find((c) => c.taskType === taskType)?.displayName ?? taskType
}
