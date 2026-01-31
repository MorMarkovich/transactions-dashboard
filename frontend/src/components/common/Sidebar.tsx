import { useState } from 'react'
import { transactionsApi } from '../../services/api'
import './Sidebar.css'

interface SidebarProps {
  sessionId?: string | null
  onFileUploaded?: (sessionId: string) => void
}

export default function Sidebar({ sessionId, onFileUploaded }: SidebarProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const response = await transactionsApi.uploadFile(file)
      if (response.success && response.session_id) {
        onFileUploaded?.(response.session_id)
      } else {
        setError('שגיאה בהעלאת הקובץ')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'שגיאה בהעלאת הקובץ')
    } finally {
      setUploading(false)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-title">
        <span>📁</span> העלאת קובץ
      </div>
      
      <div className="file-upload-area">
        <input
          type="file"
          id="file-upload"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          disabled={uploading}
          style={{ display: 'none' }}
        />
        <label htmlFor="file-upload" className="file-upload-label">
          {uploading ? '🔄 טוען...' : '📤 גרור קובץ לכאן או לחץ לבחירה'}
        </label>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="sidebar-info">
        <div className="info-title">💡 פורמטים נתמכים</div>
        <div className="info-list">
          <div>• MAX</div>
          <div>• לאומי</div>
          <div>• דיסקונט</div>
          <div>• ויזה כאל</div>
          <div>• CSV כללי</div>
        </div>
      </div>
    </aside>
  )
}
