import { useParams } from 'react-router-dom'
import { useSession, type Workplace } from '../../session'

/** Only used under RequireMembership, which guarantees the workplace exists. */
export function useWorkplace(): Workplace {
  const { businessId } = useParams()
  const { workplaces } = useSession()
  const workplace = workplaces.find((w) => w.business.id === Number(businessId))
  if (!workplace) throw new Error('useWorkplace called outside an authorized merchant route')
  return workplace
}
