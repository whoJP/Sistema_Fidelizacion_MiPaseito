import { Navigate } from 'react-router-dom'
import { useSession } from '../../session'
import { Card, Empty, PageHeader } from '../../components/ui'

export function MerchantUnassigned() {
  const { workplace } = useSession()
  if (workplace) return <Navigate to={`/merchant/${workplace.business.id}`} replace />
  return (
    <div className="page">
      <PageHeader title="Sin establecimiento asignado" />
      <Card>
        <Empty>Aún no tienes un local asignado. Pídelo a la administración.</Empty>
      </Card>
    </div>
  )
}
