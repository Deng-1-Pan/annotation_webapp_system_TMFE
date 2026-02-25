interface Props {
  label: string
  value: string | number
  tone?: 'default' | 'good' | 'warn' | 'danger'
}

export function StatPill({ label, value, tone = 'default' }: Props) {
  return (
    <div className={`stat-pill tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
