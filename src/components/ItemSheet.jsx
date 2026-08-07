import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectItemNotes } from '../lib/store'
import { areaById } from '../data/areas'
import { parseAmount, centsToInput } from '../lib/money'
import AreaIcon from './AreaIcon'

/** Bottom sheet: item details, per-item notes, bucket, archive/delete. */
export default function ItemSheet({ item, onClose }) {
  const updateItem = useStore((s) => s.updateItem)
  const archiveItem = useStore((s) => s.archiveItem)
  const restoreItem = useStore((s) => s.restoreItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const addNote = useStore((s) => s.addNote)
  const notes = useStore(useShallow(selectItemNotes(item.id)))

  const area = areaById(item.areaId)
  const money = area?.kind === 'money'
  const moneyBill = money && (item.bucket === 'Bills' || item.bucket === 'Subscriptions')
  const moneyPlan = money && item.bucket === 'Plan'

  const [title, setTitle] = useState(item.title)
  const [details, setDetails] = useState(item.details)
  const [noteDraft, setNoteDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [amountStr, setAmountStr] = useState(item.amount != null ? centsToInput(item.amount) : '')
  const [cadence, setCadence] = useState(item.cadence ?? 'monthly')
  const [nextDue, setNextDue] = useState(item.nextDue ?? '')
  const [planType, setPlanType] = useState(item.type === 'savings' ? 'savings' : 'income')

  const archived = item.status === 'archived'

  const save = () => {
    const patch = { title: title.trim() || item.title, details }
    if (money) {
      const cents = parseAmount(amountStr)
      if (cents != null) patch.amount = cents
      if (moneyBill) {
        patch.cadence = cadence
        if (nextDue) patch.nextDue = nextDue
      }
      if (moneyPlan) patch.type = planType
    }
    updateItem(item.id, patch)
    onClose()
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Item details">
        <div className="sheet-grab" />
        <h2>
          <AreaIcon name={area?.icon} size={16} /> {area?.name}
        </h2>

        <div className="field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="field">
          <label>Details</label>
          <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Notes, links, context…" />
        </div>

        {money && (
          <div className="field">
            <label>{item.bucket === 'Spending' ? 'Monthly limit' : item.bucket === 'Goals' ? 'Target' : 'Amount'}</label>
            <input inputMode="decimal" placeholder="0.00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
          </div>
        )}
        {moneyBill && (
          <>
            <div className="field">
              <label>Cadence</label>
              <div className="link-chips">
                {['weekly', 'monthly', 'yearly'].map((c) => (
                  <button key={c} className={`chip ${cadence === c ? 'on' : ''}`} onClick={() => setCadence(c)}>{c}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Next due</label>
              <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
            </div>
          </>
        )}
        {moneyPlan && (
          <div className="field">
            <label>Counts as</label>
            <div className="link-chips">
              {['income', 'savings'].map((t) => (
                <button key={t} className={`chip ${planType === t ? 'on' : ''}`} onClick={() => setPlanType(t)}>{t}</button>
              ))}
            </div>
          </div>
        )}

        {area?.buckets.length > 0 && (
          <div className="field">
            <label>Bucket</label>
            <div className="link-chips">
              {area.buckets.map((b) => (
                <button
                  key={b}
                  className={`chip ${item.bucket === b ? 'on' : ''}`}
                  onClick={() => updateItem(item.id, { bucket: item.bucket === b ? null : b })}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <label>Entry notes ({notes.length})</label>
          {notes.map((n) => (
            <div key={n.id} className="card note-card">
              <div className="note-date">{new Date(n.createdAt).toLocaleString()}</div>
              <div className="note-text">{n.text}</div>
            </div>
          ))}
          <div className="add-row">
            <input
              value={noteDraft}
              placeholder="Add a note to this entry…"
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && noteDraft.trim()) {
                  addNote(item.areaId, noteDraft, item.id)
                  setNoteDraft('')
                }
              }}
            />
            <button
              onClick={() => {
                if (noteDraft.trim()) {
                  addNote(item.areaId, noteDraft, item.id)
                  setNoteDraft('')
                }
              }}
            >
              <Plus size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="sheet-actions">
          <button className="btn-primary" onClick={save}>Save</button>
          {archived ? (
            <button className="btn-ghost" onClick={() => { restoreItem(item.id); onClose() }}>Restore</button>
          ) : (
            <button className="btn-ghost" onClick={() => { archiveItem(item.id); onClose() }}>Archive</button>
          )}
          <button
            className="btn-ghost btn-danger"
            onClick={() => {
              if (confirmDelete) { deleteItem(item.id); onClose() }
              else setConfirmDelete(true)
            }}
          >
            {confirmDelete ? 'Sure?' : 'Delete'}
          </button>
        </div>
      </div>
    </>
  )
}
