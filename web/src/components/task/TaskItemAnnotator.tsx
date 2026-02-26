import { useMemo, useState } from 'react'
import { TranscriptPanel } from '../common/TranscriptPanel'
import { getContextAroundTurn } from '../../lib/progress'
import type {
  AnnotationInput,
  AnnotationInputAi,
  AnnotationInputBoundary,
  AnnotationInputInitiation,
  AnnotationInputRole,
  BatchItemView,
  TaskType,
} from '../../types/schema'

interface Props {
  taskType: TaskType
  item: BatchItemView
  index: number
  total: number
  onSubmit: (annotation: AnnotationInput, saveAndNext: boolean) => Promise<void> | void
}

export function TaskItemAnnotator({ taskType, item, index, total, onSubmit }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initial = useMemo(() => {
    const existing = item.existingMyAnnotation?.annotation as Record<string, unknown> | undefined
    switch (taskType) {
      case 'ai_sentence_audit':
        return {
          is_ai_true: (existing?.is_ai_true as 0 | 1 | undefined) ?? 0,
          false_positive_type: (existing?.false_positive_type as string | undefined) ?? '',
          notes: (existing?.notes as string | undefined) ?? '',
        } satisfies AnnotationInputAi
      case 'role_audit_qa_turns':
        return {
          role_true: (existing?.role_true as AnnotationInputRole['role_true'] | undefined) ?? 'unknown',
          notes: (existing?.notes as string | undefined) ?? '',
        } satisfies AnnotationInputRole
      case 'qa_boundary_audit_docs':
        return {
          boundary_correct: (existing?.boundary_correct as 0 | 1 | undefined) ?? 1,
          pairing_quality:
            (existing?.pairing_quality as AnnotationInputBoundary['pairing_quality'] | undefined) ?? 'good',
          notes: (existing?.notes as string | undefined) ?? '',
        } satisfies AnnotationInputBoundary
      case 'initiation_audit_exchanges':
        return {
          question_is_ai_true: (existing?.question_is_ai_true as 0 | 1 | undefined) ?? 0,
          answer_is_ai_true: (existing?.answer_is_ai_true as 0 | 1 | undefined) ?? 0,
          initiation_type_true:
            (existing?.initiation_type_true as AnnotationInputInitiation['initiation_type_true'] | undefined) ??
            'non_ai',
          notes: (existing?.notes as string | undefined) ?? '',
        } satisfies AnnotationInputInitiation
    }
  }, [item.existingMyAnnotation, taskType])

  const [form, setForm] = useState<Record<string, unknown>>(initial)

  async function submit(saveAndNext: boolean) {
    setSaving(true)
    setError(null)
    try {
      await onSubmit(form as unknown as AnnotationInput, saveAndNext)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const p = item.taskItem.payload as unknown as Record<string, unknown>
  const qaTurnGlobalIdx =
    taskType === 'role_audit_qa_turns' && item.context
      ? item.context.qaTurns[Number(p.turn_idx ?? 0)]?.idx
      : undefined
  const roleContextTurns =
    taskType === 'role_audit_qa_turns' && typeof qaTurnGlobalIdx === 'number'
      ? getContextAroundTurn(item.context, qaTurnGlobalIdx, 2)
      : []

  return (
    <div className="annotator-layout">
      <section className="panel">
        <div className="panel-header">
          <h2>
            样本 {index + 1} / {total}
          </h2>
          <div className="mono">{item.taskItem.sampleId}</div>
        </div>

        <div className="field-grid">
          {Object.entries(p).map(([key, value]) => {
            if (key.startsWith('annotator_') || key.startsWith('adjudicated_')) return null
            if (key === 'question_text' || key === 'answer_text' || key === 'text' || key.endsWith('_preview')) {
              return (
                <div key={key} className="field-block span-2">
                  <label>{key}</label>
                  <div className="field-value long-text">{String(value ?? '')}</div>
                </div>
              )
            }
            return (
              <div key={key} className="field-block">
                <label>{key}</label>
                <div className="field-value">{String(value ?? '')}</div>
              </div>
            )
          })}
        </div>

        {taskType === 'role_audit_qa_turns' && (
          <section className="panel nested-panel">
            <h3>当前 Turn 前后上下文</h3>
            <div className="turn-list compact">
              {roleContextTurns.map((turn) => (
                <div key={turn.idx} className={`turn-item ${turn.idx === qaTurnGlobalIdx ? 'highlight' : ''}`}>
                  <div className="turn-meta">
                    <span>#{turn.idx}</span>
                    <span>{turn.role ?? 'unknown'}</span>
                    <span>{turn.isQuestion ? 'Q' : 'A'}</span>
                  </div>
                  <div className="turn-speaker">{turn.speaker}</div>
                  <p>{turn.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="panel nested-panel">
          <h3>标注表单</h3>
          {taskType === 'ai_sentence_audit' && (
            <>
              <BinarySelect
                label="is_ai_true"
                value={Number(form.is_ai_true ?? 0)}
                onChange={(v) => setForm((f) => ({ ...f, is_ai_true: v as 0 | 1 }))}
              />
              <TextInput
                label="false_positive_type（可选）"
                value={String(form.false_positive_type ?? '')}
                onChange={(v) => setForm((f) => ({ ...f, false_positive_type: v }))}
              />
            </>
          )}

          {taskType === 'role_audit_qa_turns' && (
            <SelectInput
              label="role_true"
              value={String(form.role_true ?? 'unknown')}
              options={['analyst', 'management', 'operator', 'unknown']}
              onChange={(v) => setForm((f) => ({ ...f, role_true: v }))}
            />
          )}

          {taskType === 'qa_boundary_audit_docs' && (
            <>
              <BinarySelect
                label="boundary_correct"
                value={Number(form.boundary_correct ?? 1)}
                onChange={(v) => setForm((f) => ({ ...f, boundary_correct: v as 0 | 1 }))}
              />
              <SelectInput
                label="pairing_quality"
                value={String(form.pairing_quality ?? 'good')}
                options={['good', 'minor_issue', 'major_issue', 'unusable']}
                onChange={(v) => setForm((f) => ({ ...f, pairing_quality: v }))}
              />
            </>
          )}

          {taskType === 'initiation_audit_exchanges' && (
            <>
              <BinarySelect
                label="question_is_ai_true"
                value={Number(form.question_is_ai_true ?? 0)}
                onChange={(v) => setForm((f) => ({ ...f, question_is_ai_true: v as 0 | 1 }))}
              />
              <BinarySelect
                label="answer_is_ai_true"
                value={Number(form.answer_is_ai_true ?? 0)}
                onChange={(v) => setForm((f) => ({ ...f, answer_is_ai_true: v as 0 | 1 }))}
              />
              <SelectInput
                label="initiation_type_true"
                value={String(form.initiation_type_true ?? 'non_ai')}
                options={['analyst_initiated', 'management_pivot', 'analyst_only', 'non_ai']}
                onChange={(v) => setForm((f) => ({ ...f, initiation_type_true: v }))}
              />
            </>
          )}

          <TextareaInput
            label="notes"
            value={String(form.notes ?? '')}
            onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
          />

          {error && <div className="error-msg">{error}</div>}
          <div className="toolbar-row">
            <button className="btn" disabled={saving} onClick={() => void submit(false)}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button className="btn btn-primary" disabled={saving} onClick={() => void submit(true)}>
              保存并下一条
            </button>
          </div>
        </section>
      </section>

      {(taskType === 'role_audit_qa_turns' || taskType === 'qa_boundary_audit_docs') && (
        <TranscriptPanel
          context={item.context}
          highlightTurnIdx={taskType === 'role_audit_qa_turns' ? qaTurnGlobalIdx : undefined}
          mode={taskType === 'qa_boundary_audit_docs' ? 'boundary' : 'role'}
        />
      )}
    </div>
  )
}

function SelectInput(props: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="form-control">
      <span>{props.label}</span>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}

function BinarySelect(props: {
  label: string
  value: number
  onChange: (value: 0 | 1) => void
}) {
  return (
    <label className="form-control">
      <span>{props.label}</span>
      <div className="radio-row">
        <label>
          <input type="radio" checked={props.value === 1} onChange={() => props.onChange(1)} /> 1
        </label>
        <label>
          <input type="radio" checked={props.value === 0} onChange={() => props.onChange(0)} /> 0
        </label>
      </div>
    </label>
  )
}

function TextInput(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="form-control">
      <span>{props.label}</span>
      <input value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  )
}

function TextareaInput(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="form-control">
      <span>{props.label}</span>
      <textarea rows={4} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  )
}
