import { Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CakeSlice,
  CalendarDays,
  ChevronUp,
  ClipboardList,
  Disc3,
  FileX2,
  Compass,
  FolderTree,
  Gift,
  History,
  Home,
  IdCard,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Map as MapIcon,
  MapPin,
  Medal,
  Megaphone,
  ReceiptText,
  ScanLine,
  Settings,
  ShieldCheck,
  Target,
  Trophy,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { signOut, useSession } from '../session'
import { useDb } from '../data/store'
import type { User } from '../types/domain'
import { Toaster } from '../components/ui'
import { DialogHost } from '../components/dialog'
import { BrandMark } from '../components/BrandMark'
import { MEMBER_ROLE_LABELS } from '../lib/format'

interface NavItem {
  to: string
  label: string
  /** Label in the phone tab bar, where space is tight. */
  short?: string
  icon: LucideIcon
  end?: boolean
  count?: number
  /** Shown in the phone tab bar; the rest go under "Más". */
  primary?: boolean
}

const TABBAR_MAX = 5

const CUSTOMER_NAV: NavItem[] = [
  { to: '/app', label: 'Inicio', icon: Home, end: true, primary: true },
  { to: '/app/rewards', label: 'Recompensas', short: 'Premios', icon: Gift, primary: true },
  { to: '/app/missions', label: 'Misiones', icon: Target, primary: true },
  { to: '/app/passport', label: 'Pasaporte', icon: MapIcon, primary: true },
  { to: '/app/ranking', label: 'Ranking', icon: Trophy },
  { to: '/app/spin', label: 'Ruleta', icon: Disc3 },
  { to: '/app/scan', label: 'Visitar un espacio', short: 'Espacios', icon: ScanLine },
  { to: '/app/directory', label: 'Directorio', icon: Compass },
  { to: '/app/activity', label: 'Actividad', icon: History },
  { to: '/app/badges', label: 'Insignias', icon: Award },
]

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true, primary: true },
  { to: '/admin/metrics', label: 'Métricas', icon: BarChart3 },
  { to: '/admin/businesses', label: 'Establecimientos', short: 'Locales', icon: Building2, primary: true },
  { to: '/admin/categories', label: 'Categorías', icon: FolderTree },
  { to: '/admin/tiers', label: 'Niveles', icon: Medal },
  { to: '/admin/rewards', label: 'Recompensas', icon: Gift },
  { to: '/admin/missions', label: 'Misiones', icon: Target },
  { to: '/admin/promotions', label: 'Promociones', icon: Megaphone },
  { to: '/admin/events', label: 'Eventos', icon: CalendarDays },
  { to: '/admin/spaces', label: 'Espacios', icon: MapPin },
  { to: '/admin/spin', label: 'Ruleta', icon: Disc3 },
  { to: '/admin/badges', label: 'Insignias', icon: Award },
  { to: '/admin/fraud', label: 'Fraude', icon: AlertTriangle, primary: true },
  { to: '/admin/cancellations', label: 'Anulaciones', icon: FileX2, primary: true },
  { to: '/admin/kyc', label: 'Verificaciones', icon: IdCard },
  { to: '/admin/users', label: 'Usuarios', icon: Users },
  { to: '/admin/audit', label: 'Auditoría', icon: ClipboardList },
  { to: '/admin/settings', label: 'Configuración', icon: Settings },
]

function merchantNav(businessId: number, isManager: boolean): NavItem[] {
  const base = `/merchant/${businessId}`
  return [
    { to: base, label: 'Registrar compra', short: 'Compra', icon: ReceiptText, end: true, primary: true },
    { to: `${base}/validate`, label: 'Validar canje', short: 'Canje', icon: ScanLine, primary: true },
    { to: `${base}/birthday`, label: 'Cumpleaños', icon: CakeSlice, primary: true },
    { to: `${base}/transactions`, label: 'Movimientos', icon: History, primary: true },
    ...(isManager
      ? [
          { to: `${base}/rewards`, label: 'Recompensas', short: 'Premios', icon: Gift },
          { to: `${base}/catalog`, label: 'Catálogo', icon: BookOpen },
        ]
      : []),
  ]
}

export function AppShell() {
  const { user, workplace } = useSession()
  const db = useDb()
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  if (!user) return null

  const role = user.role === 'ADMIN' ? 'admin' : user.role === 'MERCHANT' ? 'merchant' : 'customer'
  const adminCounts: Record<string, number> = {
    '/admin/cancellations': db.cancellationRequests.filter((r) => r.status === 'PENDING').length,
    '/admin/kyc': db.kycRequests.filter((r) => r.status === 'PENDING').length,
  }
  const nav =
    role === 'admin'
      ? ADMIN_NAV.map((item) => (item.to in adminCounts ? { ...item, count: adminCounts[item.to] } : item))
      : role === 'merchant'
        ? workplace
          ? merchantNav(workplace.business.id, workplace.membership.role === 'MANAGER')
          : []
        : CUSTOMER_NAV
  const contextLabel = role === 'admin' ? 'Consola interna' : role === 'merchant' ? (workplace?.business.name ?? 'Personal') : 'Cliente'
  const roleLabel = role === 'admin' ? 'Administrador' : workplace ? MEMBER_ROLE_LABELS[workplace.membership.role] : 'Personal'
  const fitsTabbar = nav.length <= TABBAR_MAX
  const tabs = fitsTabbar ? nav : nav.filter((item) => item.primary)
  const more = fitsTabbar ? [] : nav.filter((item) => !item.primary)

  return (
    <div className={`shell shell-${role}`}>
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <div className="brand">
          {role === 'admin' ? (
            <span className="brand-mark" aria-hidden>
              PA
            </span>
          ) : (
            <BrandMark />
          )}
          <span className="brand-text">
            <span className="brand-name">
              {role === 'admin' ? (
                <>
                  Paseo <b>Aranjuez</b>
                </>
              ) : (
                <>
                  Paseo <b>Club</b>
                </>
              )}
            </span>
            <span className="brand-context">{contextLabel}</span>
          </span>
        </div>

        <nav className="nav" aria-label="Navegación principal">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
              <item.icon size={18} aria-hidden />
              <span>{item.label}</span>
              {!!item.count && (
                <span className="nav-count" aria-label={`${item.count} pendientes`}>
                  {item.count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <UserMenu user={user} />
        </div>
      </aside>

      <header className="mobile-bar">
        <div className="brand">
          {role === 'admin' ? (
            <span className="brand-mark" aria-hidden>
              PA
            </span>
          ) : (
            <BrandMark size={34} />
          )}
          <span className="brand-text">
            <span className="brand-name">
              Paseo <b>{role === 'admin' ? 'Aranjuez' : 'Club'}</b>
            </span>
            <span className="brand-context">{role === 'customer' ? 'Paseo Aranjuez' : `${contextLabel} · ${roleLabel}`}</span>
          </span>
        </div>
        <UserMenu user={user} compact />
      </header>

      <main className="content" id="main">
        {role !== 'customer' && (
          <div className="staff-bar">
            <span className="staff-org">
              <ShieldCheck size={15} aria-hidden />
              Paseo Aranjuez
            </span>
            <span className="staff-scope">
              {role === 'admin' ? 'Administración del programa' : workplace ? `Socio comercial · ${workplace.business.name}` : 'Socio comercial'}
            </span>
            <span className="staff-role">{roleLabel}</span>
          </div>
        )}
        <Suspense
          fallback={
            <p className="page muted" role="status">
              Cargando…
            </p>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      {tabs.length > 0 && <TabBar tabs={tabs} more={more} />}
      <Toaster />
      <DialogHost />
    </div>
  )
}

/** Phone navigation: the main sections in a bottom bar and the rest in a "Más" sheet. */
function TabBar({ tabs, more }: { tabs: NavItem[]; more: NavItem[] }) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const isActive = (item: NavItem) => (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`))
  const moreActive = more.some(isActive)
  const moreCount = more.reduce((s, item) => s + (item.count ?? 0), 0)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <nav className="tabbar" aria-label="Secciones">
        {tabs.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="tab-link" onClick={() => setOpen(false)}>
            <span className="tab-icon">
              <item.icon size={22} aria-hidden />
              {!!item.count && <span className="tab-count">{item.count}</span>}
            </span>
            <span className="tab-label">{item.short ?? item.label}</span>
          </NavLink>
        ))}
        {more.length > 0 && (
          <button type="button" className={`tab-link ${open || moreActive ? 'active' : ''}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span className="tab-icon">
              <LayoutGrid size={22} aria-hidden />
              {moreCount > 0 && <span className="tab-count">{moreCount}</span>}
            </span>
            <span className="tab-label">Más</span>
          </button>
        )}
      </nav>
      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Más secciones" onClick={(e) => e.stopPropagation()}>
            <span className="sheet-grip" aria-hidden />
            <div className="row between">
              <h2 className="small-title">Más secciones</h2>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            <nav className="sheet-grid" aria-label="Más secciones">
              {more.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="sheet-link" onClick={() => setOpen(false)}>
                  <item.icon size={22} aria-hidden />
                  <span>{item.label}</span>
                  {!!item.count && <span className="tab-count">{item.count}</span>}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}

function UserMenu({ user, compact = false }: { user: User; compact?: boolean }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }

  return (
    <div className={`me-wrap ${compact ? 'me-wrap-compact' : ''}`} ref={ref}>
      <button
        className={`me me-btn ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Cuenta de ${user.firstName} ${user.lastName}`}
      >
        <span className="avatar" aria-hidden>
          {user.firstName[0]}
        </span>
        {!compact && (
          <>
            <div>
              <strong>
                {user.firstName} {user.lastName}
              </strong>
              <span className="muted small">{user.email}</span>
            </div>
            <ChevronUp size={16} className="me-caret" aria-hidden />
          </>
        )}
      </button>
      {open && (
        <div className={`me-menu ${compact ? 'me-menu-down' : ''}`} role="menu">
          <div className="me-menu-head">
            <strong>
              {user.firstName} {user.lastName}
            </strong>
            <span className="muted small">{user.email}</span>
          </div>
          <button role="menuitem" className="me-item" onClick={() => go('/account')}>
            <UserRound size={17} aria-hidden /> Mi perfil
          </button>
          <button
            role="menuitem"
            className="me-item me-item-danger"
            onClick={() => {
              setOpen(false)
              signOut()
              navigate('/login')
            }}
          >
            <LogOut size={17} aria-hidden /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
