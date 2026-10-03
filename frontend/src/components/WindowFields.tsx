import { startLocked, windowError, type Window } from '../domain/schedule'
import { fromLocalInput, toLocalInput } from '../lib/format'
import { useNow } from '../lib/useNow'
import { Field } from './ui'

export interface WindowDraft {
  startsAt: string
  endsAt: string
}

/** Error for `datetime-local` drafts, using the same rule the server applies. */
export function draftWindowError(draft: WindowDraft, previous: Window | null, required: boolean): string | null {
  return windowError({ startsAt: fromLocalInput(draft.startsAt), endsAt: fromLocalInput(draft.endsAt) }, previous, required)
}

/**
 * Start/end inputs: no dates before now, the end after the start, and a start that already passed stays locked.
 * `previous` is the saved record when editing.
 */
export function WindowFields({
  value,
  onChange,
  previous,
  required,
  startLabel = 'Inicio',
  endLabel = 'Fin',
}: {
  value: WindowDraft
  onChange: (value: WindowDraft) => void
  previous: Window | null
  required: boolean
  startLabel?: string
  endLabel?: string
}) {
  const now = useNow(30_000)
  const locked = startLocked(previous, new Date(now))
  const min = toLocalInput(new Date(now - 10 * 60_000).toISOString())
  const endKept = !!previous?.endsAt && toLocalInput(previous.endsAt) === value.endsAt
  const error = draftWindowError(value, previous, required)
  const startError = error && /inicio no|no se puede cambiar|Indica/.test(error) ? error : null
  const endError = error && !startError ? error : null
  const optionalHint = required ? undefined : 'Opcional'

  return (
    <div className="grid-2">
      <Field label={startLabel} error={startError} hint={locked ? 'Ya comenzó: no se puede cambiar' : optionalHint}>
        <input
          type="datetime-local"
          required={required}
          disabled={locked}
          min={locked ? undefined : min}
          value={value.startsAt}
          onChange={(e) => onChange({ ...value, startsAt: e.target.value })}
          aria-invalid={!!startError}
        />
      </Field>
      <Field label={endLabel} error={endError} hint={optionalHint}>
        <input
          type="datetime-local"
          required={required}
          min={endKept ? undefined : value.startsAt && value.startsAt > min ? value.startsAt : min}
          value={value.endsAt}
          onChange={(e) => onChange({ ...value, endsAt: e.target.value })}
          aria-invalid={!!endError}
        />
      </Field>
    </div>
  )
}
