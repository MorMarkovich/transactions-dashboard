import { type ReactNode, type ElementType, useEffect } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: ElementType
  actions?: ReactNode
}

export default function PageHeader({ title, subtitle, icon: Icon, actions }: PageHeaderProps) {
  useEffect(() => {
    document.title = `${title} | פנקס`
  }, [title])

  return (
    <header className="page-header">
      <div className="page-header-info">
        {Icon && (
          <div className="page-header-icon" aria-hidden="true">
            <Icon size={22} />
          </div>
        )}
        <div className="page-header-text">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  )
}
