import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import { CameraOff, Flashlight, FlashlightOff, Lock, RotateCcw, ScanLine } from 'lucide-react'

type CameraState = 'starting' | 'live' | 'insecure' | 'denied' | 'missing' | 'busy' | 'failed'

const REPEAT_MS = 3000
const HIT_MS = 700

const PROBLEMS: Record<Exclude<CameraState, 'starting' | 'live'>, { title: string; text: string; retry: boolean }> = {
  insecure: {
    title: 'La cámara necesita una conexión segura',
    text: 'Abre Paseo Club con una dirección que empiece con https:// para poder escanear. Mientras tanto, puedes escribir el código a mano.',
    retry: false,
  },
  denied: {
    title: 'Falta el permiso de la cámara',
    text: 'Toca el candado junto a la dirección del navegador, permite la cámara y vuelve a intentar.',
    retry: true,
  },
  missing: {
    title: 'No encontramos una cámara',
    text: 'Este dispositivo no tiene cámara disponible. Puedes escribir el código a mano.',
    retry: true,
  },
  busy: {
    title: 'La cámara está ocupada',
    text: 'Otra app o pestaña la está usando. Ciérrala y vuelve a intentar.',
    retry: true,
  },
  failed: {
    title: 'No se pudo abrir la cámara',
    text: 'Vuelve a intentar. Si sigue fallando, puedes escribir el código a mano.',
    retry: true,
  },
}

function problemOf(err: unknown): CameraState {
  const message = err instanceof Error ? `${err.name} ${err.message}` : String(err)
  if (/NotAllowed|denied|Permission/i.test(message)) return 'denied'
  if (/NotFound|not found|Overconstrained/i.test(message)) return 'missing'
  if (/NotReadable|in use|Could not start/i.test(message)) return 'busy'
  return 'failed'
}

/**
 * Live QR reader with the device camera (no photos from the gallery: the code must be scanned at the counter).
 * Browsers only open the camera on https or localhost.
 */
export function QrReader({ onScan, paused = false, label = 'Apunta la cámara al código QR' }: { onScan: (text: string) => void; paused?: boolean; label?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const onScanRef = useRef(onScan)
  const pausedRef = useRef(paused)
  const lastRef = useRef({ text: '', at: 0 })
  const [state, setState] = useState<CameraState>('starting')
  const [attempt, setAttempt] = useState(0)
  const [hasFlash, setHasFlash] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [hit, setHit] = useState(false)
  const secure = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia

  useEffect(() => {
    onScanRef.current = onScan
    pausedRef.current = paused
  })

  useEffect(() => {
    if (!hit) return
    const timer = setTimeout(() => setHit(false), HIT_MS)
    return () => clearTimeout(timer)
  }, [hit])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !secure) return
    const emit = (text: string) => {
      const now = Date.now()
      if (pausedRef.current || (text === lastRef.current.text && now - lastRef.current.at < REPEAT_MS)) return
      lastRef.current = { text, at: now }
      setHit(true)
      navigator.vibrate?.(60)
      onScanRef.current(text.trim())
    }
    const scanner = new QrScanner(video, (result) => emit(result.data), {
      preferredCamera: 'environment',
      maxScansPerSecond: 10,
      returnDetailedScanResult: true,
    })
    scannerRef.current = scanner
    let cancelled = false
    scanner
      .start()
      .then(async () => {
        if (cancelled) return
        setState('live')
        setHasFlash(await scanner.hasFlash().catch(() => false))
      })
      .catch((err: unknown) => {
        if (!cancelled) setState(problemOf(err))
      })
    return () => {
      cancelled = true
      scannerRef.current = null
      scanner.destroy()
    }
  }, [attempt, secure])

  const retry = () => {
    setState('starting')
    setFlashOn(false)
    setHasFlash(false)
    setAttempt((n) => n + 1)
  }

  const toggleFlash = async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    await scanner.toggleFlash().catch(() => undefined)
    setFlashOn(scanner.isFlashOn())
  }

  const current: CameraState = secure ? state : 'insecure'
  const showVideo = current === 'starting' || current === 'live'
  const problem = current === 'starting' || current === 'live' ? null : PROBLEMS[current]

  return (
    <div className="qr-reader">
      <div className={`qr-viewport ${showVideo ? '' : 'is-idle'} ${paused ? 'is-paused' : ''} ${hit ? 'is-hit' : ''}`}>
        <video ref={videoRef} muted playsInline aria-label="Vista de la cámara" />
        {showVideo && (
          <>
            <span className="qr-frame" aria-hidden />
            {state === 'live' && !paused && <span className="qr-laser" aria-hidden />}
            {state === 'starting' && <span className="qr-spinner" aria-hidden />}
            {hasFlash && state === 'live' && (
              <button
                type="button"
                className={`qr-flash ${flashOn ? 'is-on' : ''}`}
                onClick={() => void toggleFlash()}
                aria-pressed={flashOn}
                aria-label={flashOn ? 'Apagar linterna' : 'Encender linterna'}
              >
                {flashOn ? <FlashlightOff size={18} /> : <Flashlight size={18} />}
              </button>
            )}
          </>
        )}
        {problem && (
          <div className="qr-idle">
            <span className="qr-idle-icon" aria-hidden>
              {current === 'insecure' ? <Lock size={24} /> : <CameraOff size={24} />}
            </span>
            <strong>{problem.title}</strong>
            <p>{problem.text}</p>
            {problem.retry && (
              <button type="button" className="btn btn-sm" onClick={retry}>
                <RotateCcw size={15} aria-hidden /> Reintentar
              </button>
            )}
          </div>
        )}
      </div>
      {showVideo && (
        <p className="qr-caption" role="status">
          <ScanLine size={15} aria-hidden />
          {state === 'starting' ? 'Abriendo la cámara…' : paused ? 'Leyendo el código…' : label}
        </p>
      )}
    </div>
  )
}
