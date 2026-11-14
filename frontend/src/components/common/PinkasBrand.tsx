import { PanelsTopLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PinkasBrand({ to = '/', onClick }: { to?: string; onClick?: () => void }) {
  return (
    <Link className="pinkas-brand" to={to} onClick={onClick} aria-label="פנקס – עמוד הבית">
      <span className="pinkas-mark"><PanelsTopLeft size={19} aria-hidden="true" /></span>
      <strong>פנקס</strong>
    </Link>
  )
}
