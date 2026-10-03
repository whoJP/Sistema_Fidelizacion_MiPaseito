import { useState } from 'react'
import { BellRing } from 'lucide-react'
import { useDb } from '../data/store'
import { formatDateTime } from '../lib/format'
import { useUser } from '../session'
import { run } from './ui'

/** Unread notices for the signed-in user. "Entendido" marks them as read. */
export function Notices() {
  const db = useDb()
  const user = useUser()
  const [busy, setBusy] = useState<number | null>(null)
  const unread = db.notifications.filter((n) => n.userId === user.id && n.readAt === null).sort((a, b) => b.id - a.id)
  if (unread.length === 0) return null

  const dismiss = async (id: number) => {
    setBusy(id)
    await run('dismissNotification', { notificationId: id })
    setBusy(null)
  }

  return (
    <section className="notices" aria-label="Avisos">
      {unread.map((n) => (
        <article key={n.id} className="notice" role="status">
          <span className="notice-icon" aria-hidden>
            <BellRing size={18} />
          </span>
          <div className="notice-body">
            <strong>{n.title}</strong>
            <p>{n.message}</p>
            <span className="muted small">{formatDateTime(n.createdAt)}</span>
          </div>
          <button className="btn btn-sm" onClick={() => dismiss(n.id)} disabled={busy === n.id}>
            Entendido
          </button>
        </article>
      ))}
    </section>
  )
}
