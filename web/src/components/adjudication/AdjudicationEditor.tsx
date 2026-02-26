import { useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { TranscriptPanel } from '../common/TranscriptPanel'
import type { AdjudicationDetailView, TaskType } from '../../types/schema'

interface Props {
  detail: AdjudicationDetailView
  onSave: (payload: { adjudicated: Record<string, unknown>; notes?: string }, saveNext: boolean) => Promise<void> | void
}

export function AdjudicationEditor({ detail, onSave }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initial = useMemo(() => {
    const existing = detail.adjudication?.adjudicated ?? {}
    const notes = detail.adjudication?.notes ?? ''
    switch (detail.taskItem.taskType) {
      case 'ai_sentence_audit':
        return { adjudicated_is_ai_true: Number(existing.adjudicated_is_ai_true ?? 0), notes }
      case 'role_audit_qa_turns':
        return { adjudicated_role_true: String(existing.adjudicated_role_true ?? 'unknown'), notes }
      case 'qa_boundary_audit_docs':
        return {
          adjudicated_boundary_correct: Number(existing.adjudicated_boundary_correct ?? 1),
          adjudicated_pairing_quality: String(existing.adjudicated_pairing_quality ?? 'good'),
          notes,
        }
      case 'initiation_audit_exchanges':
        return {
          adjudicated_question_is_ai_true: Number(existing.adjudicated_question_is_ai_true ?? 0),
          adjudicated_answer_is_ai_true: Number(existing.adjudicated_answer_is_ai_true ?? 0),
          adjudicated_initiation_type_true: String(existing.adjudicated_initiation_type_true ?? 'non_ai'),
          notes,
        }
    }
  }, [detail.adjudication, detail.taskItem.taskType])

  const [form, setForm] = useState<Record<string, unknown>>(initial)

  async function submit(saveNext: boolean) {
    setSaving(true)
    setError(null)
    try {
      const { notes, ...adjudicated } = form
      await onSave({ adjudicated, notes: String(notes ?? '') }, saveNext)
    } catch (err) {
      setError(err instanceof Error ? err.message : '仲裁保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="annotator-layout">
      <section className="panel">
        <div className="panel-header">
          <h2>仲裁详情 {detail.taskItem.sampleId}</h2>
          <div className={`status-badge ${detail.status}`}>{detail.status}</div>
        </div>

        <section className="panel nested-panel">
          <h3>原始样本</h3>
          <div className="field-grid">
            {Object.entries(detail.taskItem.payload as unknown as Record<string, unknown>).map(([k, v]) => {
              if (k.startsWith('annotator_') || k.startsWith('adjudicated_')) return null
              return (
                <div key={k} className={`field-block ${String(v ?? '').length > 100 ? 'span-2' : ''}`}>
                  <label>{k}</label>
                  <div className={`field-value ${String(v ?? '').length > 100 ? 'long-text' : ''}`}>{String(v ?? '')}</div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="panel nested-panel">
          <h3>A/B 对比（导出槽位）</h3>
          <div className="ab-grid">
            <ABColumn title="Annotator A" ann={detail.annotationsAB[0]} conflictFields={detail.conflictFields} taskType={detail.taskItem.taskType} />
            <ABColumn title="Annotator B" ann={detail.annotationsAB[1]} conflictFields={detail.conflictFields} taskType={detail.taskItem.taskType} />
          </div>
        </section>

        <section className="panel nested-panel">
          <h3>仲裁填写</h3>
          <TaskSpecificAdjudicationFields taskType={detail.taskItem.taskType} form={form} setForm={setForm} />
          <label className="form-control">
            <span>仲裁备注</span>
            <textarea rows={4} value={String(form.notes ?? '')} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>
          {error && <div className="error-msg">{error}</div>}
          <div className="toolbar-row">
            <button className="btn" disabled={saving} onClick={() => void submit(false)}>保存仲裁</button>
            <button className="btn btn-primary" disabled={saving} onClick={() => void submit(true)}>保存并下一条</button>
          </div>
        </section>
      </section>

      {(detail.taskItem.taskType === 'role_audit_qa_turns' || detail.taskItem.taskType === 'qa_boundary_audit_docs') && (
        <TranscriptPanel
          context={detail.context}
          highlightTurnIdx={
            detail.taskItem.taskType === 'role_audit_qa_turns' && detail.context
              ? detail.context.qaTurns[
                Number((detail.taskItem.payload as unknown as Record<string, unknown>).turn_idx ?? 0)
              ]?.idx
              : undefined
          }
          mode={detail.taskItem.taskType === 'qa_boundary_audit_docs' ? 'boundary' : 'role'}
        />
      )}
    </div>
  )
}

function ABColumn(props: {
  title: string
  ann: AdjudicationDetailView['annotationsAB'][number] | undefined
  conflictFields: string[]
  taskType: TaskType
}) {
  if (!props.ann) {
    return <div className="panel muted">{props.title}: 暂无</div>
  }
  return (
    <div className="panel muted">
      <div className="panel-header">
        <h4>{props.title}</h4>
        <div>{props.ann.userName}</div>
      </div>
      <div className="mini-grid">
        {Object.entries(props.ann.annotation as unknown as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className={`mini-row ${props.conflictFields.includes(k) ? 'conflict' : ''}`}>
            <span>{k}</span>
            <strong>{String(v ?? '')}</strong>
          </div>
        ))}
      </div>
      <div className="muted-text">{props.ann.submittedAt}</div>
    </div>
  )
}

function TaskSpecificAdjudicationFields({
  taskType,
  form,
  setForm,
}: {
  taskType: TaskType
  form: Record<string, unknown>
  setForm: Dispatch<SetStateAction<Record<string, unknown>>>
}) {
  switch (taskType) {
    case 'ai_sentence_audit':
      return (
        <BinaryRow
          label="adjudicated_is_ai_true"
          value={Number(form.adjudicated_is_ai_true ?? 0)}
          onChange={(v) => setForm((f) => ({ ...f, adjudicated_is_ai_true: v }))}
        />
      )
    case 'role_audit_qa_turns':
      return (
        <SelectRow
          label="adjudicated_role_true"
          value={String(form.adjudicated_role_true ?? 'unknown')}
          options={['analyst', 'management', 'operator', 'unknown']}
          onChange={(v) => setForm((f) => ({ ...f, adjudicated_role_true: v }))}
        />
      )
    case 'qa_boundary_audit_docs':
      return (
        <>
          <BinaryRow
            label="adjudicated_boundary_correct"
            value={Number(form.adjudicated_boundary_correct ?? 1)}
            onChange={(v) => setForm((f) => ({ ...f, adjudicated_boundary_correct: v }))}
          />
          <SelectRow
            label="adjudicated_pairing_quality"
            value={String(form.adjudicated_pairing_quality ?? 'good')}
            options={['good', 'minor_issue', 'major_issue', 'unusable']}
            onChange={(v) => setForm((f) => ({ ...f, adjudicated_pairing_quality: v }))}
          />
        </>
      )
    case 'initiation_audit_exchanges':
      return (
        <>
          <BinaryRow
            label="adjudicated_question_is_ai_true"
            value={Number(form.adjudicated_question_is_ai_true ?? 0)}
            onChange={(v) => setForm((f) => ({ ...f, adjudicated_question_is_ai_true: v }))}
          />
          <BinaryRow
            label="adjudicated_answer_is_ai_true"
            value={Number(form.adjudicated_answer_is_ai_true ?? 0)}
            onChange={(v) => setForm((f) => ({ ...f, adjudicated_answer_is_ai_true: v }))}
          />
          <SelectRow
            label="adjudicated_initiation_type_true"
            value={String(form.adjudicated_initiation_type_true ?? 'non_ai')}
            options={['analyst_initiated', 'management_pivot', 'analyst_only', 'non_ai']}
            onChange={(v) => setForm((f) => ({ ...f, adjudicated_initiation_type_true: v }))}
          />
        </>
      )
  }
}

function SelectRow(props: {
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
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </label>
  )
}

function BinaryRow(props: { label: string; value: number; onChange: (value: 0 | 1) => void }) {
  return (
    <label className="form-control">
      <span>{props.label}</span>
      <div className="radio-row">
        <label><input type="radio" checked={props.value === 1} onChange={() => props.onChange(1)} /> 1</label>
        <label><input type="radio" checked={props.value === 0} onChange={() => props.onChange(0)} /> 0</label>
      </div>
    </label>
  )
}
