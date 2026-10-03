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
import { AccountPage } from './pages/AccountPage'
import { RegisterPurchasePage } from './pages/merchant/RegisterPurchasePage'
import { ValidateRedemptionPage } from './pages/merchant/ValidateRedemptionPage'
import { MerchantTransactionsPage } from './pages/merchant/MerchantTransactionsPage'
import { CatalogPage } from './pages/merchant/CatalogPage'
import { MerchantRewardsPage } from './pages/merchant/MerchantRewardsPage'
import { MerchantUnassigned } from './pages/merchant/MerchantUnassigned'
import type { UserRole } from './types/domain'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminBusinesses } from './pages/admin/AdminBusinesses'
import { AdminCategories } from './pages/admin/AdminCategories'
import { AdminTiers } from './pages/admin/AdminTiers'
import { AdminRewards } from './pages/admin/AdminRewards'
import { AdminMissions } from './pages/admin/AdminMissions'
import { AdminPromotions } from './pages/admin/AdminPromotions'
import { AdminFraud } from './pages/admin/AdminFraud'
import { AdminUsers } from './pages/admin/AdminUsers'
import { AdminSettings } from './pages/admin/AdminSettings'
import { AdminMetrics } from './pages/admin/AdminMetrics'
import { AdminEvents } from './pages/admin/AdminEvents'
import { AdminBadges } from './pages/admin/AdminBadges'
import { AdminAudit } from './pages/admin/AdminAudit'
import { AdminCancellations } from './pages/admin/AdminCancellations'

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
            <Route path="/app/profile" element={<Navigate to="/account" replace />} />
          </Route>

          <Route path="/account" element={<AccountPage />} />

          <Route element={<RequireRole role="MERCHANT" />}>
            <Route path="/merchant" element={<MerchantUnassigned />} />
            <Route path="/merchant/:businessId" element={<RequireMembership />}>
              <Route index element={<RegisterPurchasePage />} />
              <Route path="validate" element={<ValidateRedemptionPage />} />
              <Route path="transactions" element={<MerchantTransactionsPage />} />
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
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
