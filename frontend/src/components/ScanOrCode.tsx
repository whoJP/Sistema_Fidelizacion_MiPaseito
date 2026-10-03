import { useState, type FormEvent } from 'react'
import { Keyboard, ScanLine } from 'lucide-react'
import { QrReader } from './QrReader'

type Kind = 'customer' | 'redemption'

const SPEC: Record<Kind, { label: string; hint: string; placeholder: string; length: number; submit: string }> = {
  customer: {
    label: 'Código del cliente',
    hint: 'Son los 6 números que aparecen debajo del QR, en la tarjeta del cliente.',
    placeholder: '000 000',
    length: 6,
    submit: 'Buscar cliente',
  },
  redemption: {
    label: 'Código del canje',
    hint: 'Está debajo del QR del canje, en la app del cliente (Recompensas › Mis canjes).',
    placeholder: 'XXXXX-XXXXX',
    length: 10,
    submit: 'Validar canje',
  },
}

const clean = (kind: Kind, raw: string) =>
  kind === 'customer' ? raw.replace(/\D/g, '').slice(0, 6) : raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)

const pretty = (kind: Kind, value: string) =>
  kind === 'customer'
    ? value.replace(/^(\d{3})(\d)/, '$1 $2')
    : value.replace(/^([A-Z0-9]{5})([A-Z0-9])/, '$1-$2')

/**
 * Two ways to identify something at the counter: scan its QR with the camera (default) or type its short code.
 * `onSubmit` receives the scanned text or the typed code; resolve to `true` to clear the typed code.
 */
export function ScanOrCode({
  kind,
  onSubmit,
  busy,
  scanLabel,
}: {
  kind: Kind
  onSubmit: (value: string) => Promise<boolean | void> | boolean | void
  busy: boolean
  scanLabel: string
}) {
  const [mode, setMode] = useState<'scan' | 'code'>('scan')
  const [value, setValue] = useState('')
  const spec = SPEC[kind]
  const ready = value.length === spec.length

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ready || busy) return
    if (await onSubmit(pretty(kind, value))) setValue('')
  }

  return (
    <div className="scan-or-code">
      <div className="tabs tabs-block" role="tablist" aria-label="Forma de identificar">
        <button type="button" role="tab" aria-selected={mode === 'scan'} className={mode === 'scan' ? 'tab tab-active' : 'tab'} onClick={() => setMode('scan')}>
          <ScanLine size={16} aria-hidden /> Escanear QR
        </button>
        <button type="button" role="tab" aria-selected={mode === 'code'} className={mode === 'code' ? 'tab tab-active' : 'tab'} onClick={() => setMode('code')}>
          <Keyboard size={16} aria-hidden /> Escribir código
        </button>
      </div>

      {mode === 'scan' ? (
        <QrReader onScan={(text) => void onSubmit(text)} paused={busy} label={scanLabel} />
      ) : (
        <form className="code-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">{spec.label}</span>
            <input
              className="code-input"
              value={pretty(kind, value)}
              onChange={(e) => setValue(clean(kind, e.target.value))}
              placeholder={spec.placeholder}
              inputMode={kind === 'customer' ? 'numeric' : 'text'}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="go"
              autoFocus
            />
            <span className="field-hint">{spec.hint}</span>
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={!ready || busy}>
            {busy ? 'Buscando…' : spec.submit}
          </button>
        </form>
      )}
    </div>
  )
}
