import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Short vibration on phones that support it (Android). iOS ignores it. */
export function haptic(pattern: number | number[] = 8) {
  if (reduced()) return
  navigator.vibrate?.(pattern)
}

// ---------- Tap feedback ----------

const TAPPABLE = '.btn, .shortcut, .tile, .tab-link, .sheet-link, .demo-account, .chip, .mission-row, .mcard-toggle, .icon-btn, .place, .tab'

/**
 * Gold ripple from the touch point on tappable elements. It lives in a fixed layer clipped to the element's
 * shape, so no component needs extra markup or `overflow: hidden`.
 */
export function installTapFeedback() {
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || reduced()) return
      const el = (e.target as Element | null)?.closest<HTMLElement>(TAPPABLE)
      if (!el || el.matches(':disabled, [aria-disabled="true"]')) return
      const r = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      const rgb = el.matches('.btn-primary, .danger-solid') ? '255 255 255' : style.getPropertyValue('--accent-rgb').trim() || '245 200 76'
      const size = Math.hypot(r.width, r.height) * 2

      const host = document.createElement('span')
      host.className = 'tap-host'
      Object.assign(host.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: style.borderRadius })
      const dot = document.createElement('span')
      dot.className = 'tap-dot'
      Object.assign(dot.style, {
        width: `${size}px`,
        height: `${size}px`,
        left: `${e.clientX - r.left - size / 2}px`,
        top: `${e.clientY - r.top - size / 2}px`,
        background: `radial-gradient(circle, rgb(${rgb} / 0.26) 0%, rgb(${rgb} / 0.1) 38%, transparent 66%)`,
      })
      host.append(dot)
      document.body.append(host)
      const anim = dot.animate(
        [
          { transform: 'scale(0.08)', opacity: 1 },
          { transform: 'scale(1)', opacity: 0 },
        ],
        { duration: 650, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      )
      anim.onfinish = anim.oncancel = () => host.remove()
    },
    { passive: true },
  )
}

// ---------- Page transitions ----------

type NavDirection = 'forward' | 'back' | 'none'

function indexIn(order: string[], path: string) {
  let best = -1
  let bestLength = -1
  order.forEach((to, i) => {
    if ((path === to || path.startsWith(`${to}/`)) && to.length > bestLength) {
      best = i
      bestLength = to.length
    }
  })
  return best
}

/** Going deeper (list → detail) or to a later tab is "forward"; the opposite is "back". */
export function navDirection(from: string, to: string, order: string[]): NavDirection {
  if (to.startsWith(`${from}/`)) return 'forward'
  if (from.startsWith(`${to}/`)) return 'back'
  const a = indexIn(order, from)
  const b = indexIn(order, to)
  if (a < 0 || b < 0 || a === b) return 'none'
  return b > a ? 'forward' : 'back'
}

/**
 * Turns every in-app link click into a View Transition (where the browser supports it) and tags
 * `<html data-nav>` with the direction, so pages enter from the side the user is heading to.
 * `order` is the navigation order of the current role (tabs first).
 */
export function useLinkTransitions(order: string[]) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const latest = useRef({ pathname, order })
  useEffect(() => {
    latest.current = { pathname, order }
  })

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href]')
      if (!a || a.target || a.hasAttribute('download') || a.getAttribute('href')?.startsWith('#')) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin) return
      const { pathname: from, order } = latest.current
      if (url.pathname === from) return
      document.documentElement.dataset.nav = navDirection(from, url.pathname, order)
      if (!('startViewTransition' in document) || reduced()) return
      e.preventDefault()
      document.startViewTransition(() => flushSync(() => navigate(url.pathname + url.search + url.hash)))
    }
    const onPop = () => {
      document.documentElement.dataset.nav = 'back'
    }
    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPop)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPop)
    }
  }, [navigate])
}

// ---------- Bottom sheets ----------

const CLOSE_AT = 90

/**
 * Swipe down to close a bottom sheet (touch only). Spread the handlers on the sheet's top area;
 * `sheet` is the element that moves. Buttons inside the area keep working.
 */
export function useDragToClose(sheetSelector: string, onClose: () => void, enabled = true) {
  const state = useRef<{ el: HTMLElement; id: number; start: number; dy: number } | null>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  const release = () => {
    const s = state.current
    state.current = null
    if (!s) return
    s.el.style.transition = ''
    if (s.dy > CLOSE_AT) {
      haptic(6)
      const out = s.el.animate([{ transform: `translateY(${s.dy}px)` }, { transform: 'translateY(105%)' }], {
        duration: 220,
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        fill: 'forwards',
      })
      out.onfinish = () => close.current()
    } else {
      s.el.style.transform = ''
      s.el.animate([{ transform: `translateY(${s.dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.3, 1.5, 0.5, 1)' })
    }
  }

  return {
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      if (!enabled || e.pointerType === 'mouse' || (e.target as Element).closest('button, a, input, select, textarea')) return
      const el = e.currentTarget.closest<HTMLElement>(sheetSelector)
      if (!el || !window.matchMedia('(max-width: 768px)').matches) return
      e.currentTarget.setPointerCapture(e.pointerId)
      el.style.transition = 'none'
      state.current = { el, id: e.pointerId, start: e.clientY, dy: 0 }
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      const s = state.current
      if (!s || s.id !== e.pointerId) return
      const raw = e.clientY - s.start
      // Pulling up resists, pulling down follows the finger.
      s.dy = raw > 0 ? raw : raw / 6
      s.el.style.transform = `translateY(${s.dy}px)`
    },
    onPointerUp: release,
    onPointerCancel: release,
  }
}
