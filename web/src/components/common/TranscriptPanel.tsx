import { useEffect, useMemo, useState } from 'react'
import type { TranscriptDocContext } from '../../types/schema'

interface Props {
  context?: TranscriptDocContext
  highlightTurnIdx?: number
  highlightTurnIdxs?: number[]
  mode?: 'role' | 'boundary' | 'generic'
}

export function TranscriptPanel({
  context,
  highlightTurnIdx,
  highlightTurnIdxs,
  mode = 'generic',
}: Props) {
  const defaultView = mode === 'generic' ? 'qa' : 'merged'
  const defaultExpanded = mode === 'role' || mode === 'boundary'
  const [showFull, setShowFull] = useState(defaultExpanded)
  const [view, setView] = useState<'qa' | 'speech' | 'merged'>(defaultView)

  useEffect(() => {
    setShowFull(defaultExpanded)
    setView(defaultView)
  }, [context?.docId, defaultExpanded, defaultView])

  if (!context) {
    return <div className="panel muted">暂无 transcript 上下文</div>
  }

  const turns = view === 'speech' ? context.speechTurns : view === 'merged' ? (context.mergedTurns ?? []) : context.qaTurns
  const previewTurns = showFull ? turns : turns.slice(0, 8)
  const boundaryIdxs = useMemo(() => {
    if (mode !== 'boundary') return []
    const lastSpeech = context.speechTurns.at(-1)?.idx
    const firstQa = context.qaTurns.at(0)?.idx
    return [lastSpeech, firstQa].filter((v): v is number => typeof v === 'number')
  }, [context.qaTurns, context.speechTurns, mode])
  const highlightSet = new Set<number>([
    ...(typeof highlightTurnIdx === 'number' ? [highlightTurnIdx] : []),
    ...(highlightTurnIdxs ?? []),
    ...boundaryIdxs,
  ])
  const speechEndIdx = mode === 'boundary' ? context.speechTurns.at(-1)?.idx : undefined
  const qaStartIdx = mode === 'boundary' ? context.qaTurns.at(0)?.idx : undefined

  return (
    <section className="panel transcript-panel">
      <div className="panel-header">
        <h3>Transcript / Script 上下文</h3>
        <div className="toolbar-row">
          <div className="segmented">
            <button className={view === 'qa' ? 'active' : ''} onClick={() => setView('qa')}>Q&A</button>
            <button className={view === 'speech' ? 'active' : ''} onClick={() => setView('speech')}>Speech</button>
            <button className={view === 'merged' ? 'active' : ''} onClick={() => setView('merged')}>原始顺序</button>
          </div>
          <button className="btn btn-secondary" onClick={() => setShowFull((s) => !s)}>
            {showFull ? '折叠' : '展开完整'}
          </button>
        </div>
      </div>
      {mode === 'boundary' && (
        <div className="quick-links">
          <a href="#speech-end">跳到 speech 尾部</a>
          <a href="#qa-start">跳到 qa 开头</a>
        </div>
      )}
      <div className="turn-list">
        {previewTurns.map((turn, idx) => {
          const anchorId =
            mode === 'boundary'
              ? turn.idx === speechEndIdx
                ? 'speech-end'
                : turn.idx === qaStartIdx
                  ? 'qa-start'
                  : undefined
              : idx === Math.max(previewTurns.length - 1, 0)
                ? 'speech-end'
                : idx === 0
                  ? 'qa-start'
                  : undefined
          return (
            <div
              key={`${turn.idx}-${idx}`}
              id={anchorId}
              className={`turn-item ${highlightSet.has(turn.idx) ? 'highlight' : ''}`}
            >
              <div className="turn-meta">
                <span>#{turn.idx}</span>
                <span>{turn.section ?? ''}</span>
                <span>{turn.role ?? 'unknown'}</span>
                {turn.isQuestion !== undefined && <span>{turn.isQuestion ? 'Q' : 'A'}</span>}
              </div>
              <div className="turn-speaker">{turn.speaker}</div>
              <p>{turn.text}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
