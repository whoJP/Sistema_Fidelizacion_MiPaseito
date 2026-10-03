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
        <Empty>Tu cuenta de personal todavía no está asignada a ningún establecimiento. Pide a la administración del Paseo que te agregue a su equipo.</Empty>
      </Card>
    </div>
  )
}
