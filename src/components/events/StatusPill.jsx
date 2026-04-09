import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getAttendanceMeta, getDeliveryDisplayMeta, getDeliveryMeta } from '@/lib/eventModuleUtils'

export function AttendancePill({ status }) {
  const meta = getAttendanceMeta(status)

  return (
    <Badge
      variant="outline"
      className={cn('rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-widest', meta.className)}
    >
      {meta.label}
    </Badge>
  )
}

export function DeliveryPill({ status }) {
  const meta = getDeliveryMeta(status)

  return (
    <Badge
      variant="outline"
      className={cn('rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-widest', meta.className)}
    >
      {meta.label}
    </Badge>
  )
}

export function DeliveryDisplayPill({ status }) {
  const meta = getDeliveryDisplayMeta(status)

  return (
    <Badge
      variant="outline"
      className={cn('rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-widest', meta.className)}
    >
      {meta.label}
    </Badge>
  )
}
