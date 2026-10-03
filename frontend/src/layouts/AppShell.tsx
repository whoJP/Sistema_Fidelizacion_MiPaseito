import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  Compass,
  FolderTree,
  Gift,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Medal,
  Megaphone,
  ReceiptText,
  ScanLine,
  Settings,
  ShieldCheck,
  Store,
  Target,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { signOut, useSession } from '../session'
import { Toaster } from '../components/ui'
import { MEMBER_ROLE_LABELS } from '../lib/format'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const CUSTOMER_NAV: NavItem[] = [
  { to: '/app', label: 'Inicio', icon: Home, end: true },
  { to: '/app/rewards', label: 'Recompensas', icon: Gift },
  { to: '/app/missions', label: 'Misiones', icon: Target },
  { to: '/app/passport', label: 'Pasaporte', icon: MapIcon },
  { to: '/app/directory', label: 'Directorio', icon: Compass },
  { to: '/app/activity', label: 'Actividad', icon: History },
  { to: '/app/profile', label: 'Mi perfil', icon: UserRound },
]

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/admin/metrics', label: 'Métricas', icon: BarChart3 },
  { to: '/admin/businesses', label: 'Establecimientos', icon: Building2 },
  { to: '/admin/categories', label: 'Categorías', icon: FolderTree },
  { to: '/admin/tiers', label: 'Niveles', icon: Medal },
  { to: '/admin/rewards', label: 'Recompensas', icon: Gift },
  { to: '/admin/missions', label: 'Misiones', icon: Target },
  { to: '/admin/promotions', label: 'Promociones', icon: Megaphone },
  { to: '/admin/events', label: 'Eventos', icon: CalendarDays },
  { to: '/admin/badges', label: 'Insignias', icon: Award },
  { to: '/admin/fraud', label: 'Fraude', icon: AlertTriangle },
  { to: '/admin/users', label: 'Usuarios', icon: Users },
  { to: '/admin/audit', label: 'Auditoría', icon: ClipboardList },
  { to: '/admin/settings', label: 'Configuración', icon: Settings },
]

function merchantNav(businessId: number, isManager: boolean): NavItem[] {
  const base = `/merchant/${businessId}`
  return [
    { to: base, label: 'Registrar compra', icon: ReceiptText, end: true },
    { to: `${base}/validate`, label: 'Validar canje', icon: ScanLine },
    { to: `${base}/transactions`, label: 'Movimientos', icon: History },
    ...(isManager
      ? [
          { to: `${base}/rewards`, label: 'Recompensas', icon: Gift },
          { to: `${base}/catalog`, label: 'Catálogo', icon: BookOpen },
        ]
      : []),
  ]
}

export function AppShell() {
  const { user, workplaces } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  if (!user) return null

  const merchantMatch = location.pathname.match(/^\/merchant\/(\d+)/)
  const workplace = merchantMatch ? workplaces.find((w) => w.business.id === Number(merchantMatch[1])) : undefined
  const context = location.pathname.startsWith('/admin')
    ? 'admin'
    : workplace
      ? `merchant:${workplace.business.id}`
      : 'customer'

  const nav =
    context === 'admin'
      ? ADMIN_NAV
      : workplace
        ? merchantNav(workplace.business.id, workplace.membership.role === 'MANAGER')
        : CUSTOMER_NAV

  const contextOptions = [
    ...(user.role === 'CUSTOMER' ? [{ value: 'customer', label: 'Mi cuenta de cliente', path: '/app' }] : []),
    ...(user.role === 'ADMIN' ? [{ value: 'admin', label: 'Administración', path: '/admin' }] : []),
    ...workplaces.map((w) => ({
      value: `merchant:${w.business.id}`,
      label: `${w.business.name} · ${MEMBER_ROLE_LABELS[w.membership.role]}`,
      path: `/merchant/${w.business.id}`,
    })),
  ]

  const role = context === 'admin' ? 'admin' : workplace ? 'merchant' : 'customer'
  const contextLabel = role === 'admin' ? 'Consola interna' : workplace ? workplace.business.name : 'Cliente'

  return (
    <div className={`shell shell-${role}`}>
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            {role === 'admin' ? 'PA' : 'P'}
          </span>
          <span className="brand-text">
            <span className="brand-name">
              {role === 'admin' ? (
                <>
                  Paseo <b>Aranjuez</b>
                </>
              ) : (
                <>
                  Paseo <b>Points</b>
                </>
              )}
            </span>
            <span className="brand-context">{contextLabel}</span>
          </span>
        </div>

        {contextOptions.length > 1 && (
          <label className="context-switch">
            <span className="sr-only">Cambiar de vista</span>
            {context.startsWith('merchant') ? <Store size={16} /> : context === 'admin' ? <BadgeCheck size={16} /> : <Home size={16} />}
            <select
              value={context}
              onChange={(e) => navigate(contextOptions.find((o) => o.value === e.target.value)!.path)}
            >
              {contextOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <nav className="nav" aria-label="Navegación principal">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
              <item.icon size={18} aria-hidden />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="me">
            <span className="avatar" aria-hidden>
              {user.firstName[0]}
            </span>
            <div>
              <strong>
                {user.firstName} {user.lastName}
              </strong>
              <span className="muted small">{user.email}</span>
            </div>
          </div>
          <button
            className="icon-btn"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            onClick={() => {
              signOut()
              navigate('/login')
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="content" id="main">
        {role !== 'customer' && (
          <div className="staff-bar">
            <span className="staff-org">
              <ShieldCheck size={15} aria-hidden />
              Paseo Aranjuez
            </span>
            <span className="staff-scope">
              {role === 'admin' ? 'Administración del programa' : `Socio comercial · ${workplace!.business.name}`}
            </span>
            <span className="staff-role">
              {role === 'admin' ? 'Administrador' : MEMBER_ROLE_LABELS[workplace!.membership.role]}
            </span>
          </div>
        )}
        <Outlet />
      </main>
      <Toaster />
    </div>
  )
}
