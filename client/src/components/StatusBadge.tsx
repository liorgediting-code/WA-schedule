interface Props {
  status: 'pending' | 'sent' | 'failed'
}

const styles: Record<Props['status'], React.CSSProperties> = {
  pending: { background: '#1d4ed8', color: '#bfdbfe' },
  sent:    { background: '#166534', color: '#bbf7d0' },
  failed:  { background: '#991b1b', color: '#fecaca' },
}

export function StatusBadge({ status }: Props) {
  return (
    <span style={{
      ...styles[status],
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      textTransform: 'uppercase',
    }}>
      {status}
    </span>
  )
}
