import { lazy, type ComponentType } from 'react'
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { AppShell } from './layouts/AppShell'
import { useSession } from './session'
import { BrandMark } from './components/BrandMark'
import { LoginPage } from './pages/LoginPage'
import { CustomerHome } from './pages/customer/CustomerHome'
import { RewardsPage } from './pages/customer/RewardsPage'
import { MissionsPage } from './pages/customer/MissionsPage'
import { PassportPage } from './pages/customer/PassportPage'
import { DirectoryPage } from './pages/customer/DirectoryPage'
import { BusinessDetailPage } from './pages/customer/BusinessDetailPage'
import { ActivityPage } from './pages/customer/ActivityPage'
import { BadgesPage } from './pages/customer/BadgesPage'
import { SpinPage } from './pages/customer/SpinPage'
import { ScanSpacePage } from './pages/customer/ScanSpacePage'
import { RankingPage } from './pages/customer/RankingPage'
import { AccountPage } from './pages/AccountPage'
import type { UserRole } from './types/domain'

// Staff screens load on demand, so customers on a phone never download them.
const merchant = () => import('./pages/merchant')
const admin = () => import('./pages/admin')
const page = <M,>(load: () => Promise<M>, pick: (m: M) => ComponentType) => lazy(() => load().then((m) => ({ default: pick(m) })))

const RegisterPurchasePage = page(merchant, (m) => m.RegisterPurchasePage)
const ValidateRedemptionPage = page(merchant, (m) => m.ValidateRedemptionPage)
const MerchantTransactionsPage = page(merchant, (m) => m.MerchantTransactionsPage)
const CatalogPage = page(merchant, (m) => m.CatalogPage)
const MerchantRewardsPage = page(merchant, (m) => m.MerchantRewardsPage)
const MerchantUnassigned = page(merchant, (m) => m.MerchantUnassigned)
const BirthdayPage = page(merchant, (m) => m.BirthdayPage)
const AdminDashboard = page(admin, (m) => m.AdminDashboard)
const AdminBusinesses = page(admin, (m) => m.AdminBusinesses)
const AdminCategories = page(admin, (m) => m.AdminCategories)
const AdminTiers = page(admin, (m) => m.AdminTiers)
const AdminRewards = page(admin, (m) => m.AdminRewards)
const AdminMissions = page(admin, (m) => m.AdminMissions)
const AdminPromotions = page(admin, (m) => m.AdminPromotions)
const AdminFraud = page(admin, (m) => m.AdminFraud)
const AdminUsers = page(admin, (m) => m.AdminUsers)
const AdminSettings = page(admin, (m) => m.AdminSettings)
const AdminMetrics = page(admin, (m) => m.AdminMetrics)
const AdminEvents = page(admin, (m) => m.AdminEvents)
const AdminBadges = page(admin, (m) => m.AdminBadges)
const AdminAudit = page(admin, (m) => m.AdminAudit)
const AdminSpaces = page(admin, (m) => m.AdminSpaces)
const AdminSpin = page(admin, (m) => m.AdminSpin)
const AdminKyc = page(admin, (m) => m.AdminKyc)
const AdminCancellations = page(admin, (m) => m.AdminCancellations)

function homeFor(session: ReturnType<typeof useSession>) {
  if (session.loading) return '/app'
  if (!session.user) return '/login'
  if (session.user.role === 'ADMIN') return '/admin'
  if (session.user.role === 'MERCHANT') return session.workplace ? `/merchant/${session.workplace.business.id}` : '/merchant'
  return '/app'
}

function RequireAuth() {
  const session = useSession()
  if (session.loading) {
    return (
      <div className="loading-screen" role="status">
        <BrandMark size={56} />
        <p className="muted">Conectando con Paseo Club…</p>
      </div>
    )
  }
  return session.user ? <Outlet /> : <Navigate to="/login" replace />
}

function RequireRole({ role }: { role: UserRole }) {
  const session = useSession()
  return session.user?.role === role ? <Outlet /> : <Navigate to={homeFor(session)} replace />
}

function RequireMembership({ managerOnly = false }: { managerOnly?: boolean }) {
  const session = useSession()
  const { businessId } = useParams()
  const workplace = session.workplace?.business.id === Number(businessId) ? session.workplace : null
  if (!workplace) return <Navigate to={homeFor(session)} replace />
  if (managerOnly && workplace.membership.role !== 'MANAGER') {
    return <Navigate to={`/merchant/${businessId}`} replace />
  }
  return <Outlet />
}

function Home() {
  return <Navigate to={homeFor(useSession())} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route element={<RequireRole role="CUSTOMER" />}>
            <Route path="/app" element={<CustomerHome />} />
            <Route path="/app/rewards" element={<RewardsPage />} />
            <Route path="/app/missions" element={<MissionsPage />} />
            <Route path="/app/passport" element={<PassportPage />} />
            <Route path="/app/directory" element={<DirectoryPage />} />
            <Route path="/app/directory/:businessId" element={<BusinessDetailPage />} />
            <Route path="/app/activity" element={<ActivityPage />} />
            <Route path="/app/badges" element={<BadgesPage />} />
            <Route path="/app/spin" element={<SpinPage />} />
            <Route path="/app/scan" element={<ScanSpacePage />} />
            <Route path="/app/ranking" element={<RankingPage />} />
            <Route path="/app/profile" element={<Navigate to="/account" replace />} />
          </Route>

          <Route path="/account" element={<AccountPage />} />

          <Route element={<RequireRole role="MERCHANT" />}>
            <Route path="/merchant" element={<MerchantUnassigned />} />
            <Route path="/merchant/:businessId" element={<RequireMembership />}>
              <Route index element={<RegisterPurchasePage />} />
              <Route path="validate" element={<ValidateRedemptionPage />} />
              <Route path="transactions" element={<MerchantTransactionsPage />} />
              <Route path="birthday" element={<BirthdayPage />} />
              <Route element={<RequireMembership managerOnly />}>
                <Route path="catalog" element={<CatalogPage />} />
                <Route path="rewards" element={<MerchantRewardsPage />} />
              </Route>
            </Route>
          </Route>

          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/businesses" element={<AdminBusinesses />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/admin/tiers" element={<AdminTiers />} />
            <Route path="/admin/rewards" element={<AdminRewards />} />
            <Route path="/admin/missions" element={<AdminMissions />} />
            <Route path="/admin/promotions" element={<AdminPromotions />} />
            <Route path="/admin/fraud" element={<AdminFraud />} />
            <Route path="/admin/cancellations" element={<AdminCancellations />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/metrics" element={<AdminMetrics />} />
            <Route path="/admin/events" element={<AdminEvents />} />
            <Route path="/admin/badges" element={<AdminBadges />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
            <Route path="/admin/spaces" element={<AdminSpaces />} />
            <Route path="/admin/spin" element={<AdminSpin />} />
            <Route path="/admin/kyc" element={<AdminKyc />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
