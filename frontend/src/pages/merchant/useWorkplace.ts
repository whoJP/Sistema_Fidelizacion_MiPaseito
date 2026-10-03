import { useParams } from 'react-router-dom'
import { useSession, type Workplace } from '../../session'

/** Only used under RequireMembership, which guarantees the workplace exists. */
export function useWorkplace(): Workplace {
  const { businessId } = useParams()
  const { workplace } = useSession()
  if (!workplace || workplace.business.id !== Number(businessId)) {
    throw new Error('useWorkplace called outside an authorized merchant route')
  }
  return workplace
}
