import { Link, useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { formatEventDate } from '@/lib/eventModuleUtils'

const baseTabs = [
  { key: 'dashboard', label: 'Dashboard', suffix: 'dashboard' },
  { key: 'invitados', label: 'Invitados', suffix: 'invitados' },
  { key: 'envios', label: 'Envios', suffix: 'envios' },
  { key: 'diseno-rsvp', label: 'Diseno RSVP', suffix: 'diseno-rsvp' },
]

export default function EventShellHeader({
  events,
  currentEvent,
  activeTab = 'dashboard',
  actions = null,
}) {
  const navigate = useNavigate()
  const { role } = useAuth()
  const tabs = role === 'admin' || role === 'planner'
    ? [...baseTabs, { key: 'cuentas', label: 'Cuentas', suffix: 'cuentas' }]
    : baseTabs

  return (
    <div className="space-y-4 border-b border-border pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.3em]">
              EVENTOS
            </Badge>
            {currentEvent && (
              <Badge
                variant="outline"
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.3em]',
                  currentEvent.status === 'active'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : currentEvent.status === 'archived'
                      ? 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                      : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                )}
              >
                {currentEvent.status}
              </Badge>
            )}
          </div>
          <div>
            <h2 className="font-heading text-3xl tracking-wide text-foreground">
              {currentEvent?.name || 'Selecciona un evento'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {currentEvent
                ? `${formatEventDate(currentEvent.event_date)} - ${currentEvent.venue || 'Sin sede definida'}`
                : 'Elige un evento para administrar invitados, RSVP y envios.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={currentEvent?.id || ''}
            onChange={(event) => {
              const nextId = event.target.value
              if (!nextId) return
              const nextSuffix = tabs.find((tab) => tab.key === activeTab)?.suffix || 'dashboard'
              navigate(`/eventos/${nextId}/${nextSuffix}`)
            }}
            className="h-10 min-w-[220px] rounded-none border border-border bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="" disabled>Selecciona un evento</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
          <Button asChild variant="outline" className="rounded-none">
            <Link to="/eventos">Cambiar evento</Link>
          </Button>
          {actions}
        </div>
      </div>

      {currentEvent && (
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab
            return (
              <Button
                key={tab.key}
                asChild
                variant={isActive ? 'default' : 'outline'}
                className="rounded-none uppercase tracking-widest"
              >
                <Link to={`/eventos/${currentEvent.id}/${tab.suffix}`}>{tab.label}</Link>
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}

