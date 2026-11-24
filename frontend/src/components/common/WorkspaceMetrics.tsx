import type { LucideIcon } from 'lucide-react'

interface WorkspaceMetric {
  label: string
  value: string | number
  icon: LucideIcon
  tone?: 'positive' | 'negative'
  detail?: string
}

interface WorkspaceMetricsProps {
  label: string
  metrics: WorkspaceMetric[]
}

export default function WorkspaceMetrics({ label, metrics }: WorkspaceMetricsProps) {
  return (
    <dl className="workspace-metrics" aria-label={label}>
      {metrics.map(({ label: metricLabel, value, icon: Icon, tone, detail }) => (
        <div key={metricLabel} className="workspace-metric" data-tone={tone}>
          <dt><Icon size={15} aria-hidden="true" /> {metricLabel}</dt>
          <dd>
            <strong><bdi>{value}</bdi></strong>
            {detail && <span>{detail}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
