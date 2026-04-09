import { CalendarClock, CheckCircle2, Clock3, Send, Users, XCircle } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

const metricConfig = [
  { key: 'total', label: 'Total invitados', icon: Users, accent: 'text-foreground' },
  { key: 'sent', label: 'Invitaciones enviadas', icon: Send, accent: 'text-blue-600 dark:text-blue-300' },
  { key: 'confirmed', label: 'Confirmados', icon: CheckCircle2, accent: 'text-emerald-600 dark:text-emerald-300' },
  { key: 'declined', label: 'Rechazados', icon: XCircle, accent: 'text-rose-600 dark:text-rose-300' },
  { key: 'pending', label: 'Pendientes', icon: Clock3, accent: 'text-amber-600 dark:text-amber-300' },
]

export default function EventMetricsGrid({ metrics, scheduleCount = 0 }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {metricConfig.map((item) => {
        const Icon = item.icon
        return (
          <Card key={item.key} className="rounded-none border-border bg-card shadow-sm">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{metrics[item.key] || 0}</p>
              </div>
              <div className="rounded-none border border-border bg-secondary/40 p-3">
                <Icon className={`h-5 w-5 ${item.accent}`} />
              </div>
            </CardContent>
          </Card>
        )
      })}

      <Card className="rounded-none border-border bg-card shadow-sm">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Programados</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{scheduleCount}</p>
          </div>
          <div className="rounded-none border border-border bg-secondary/40 p-3">
            <CalendarClock className="h-5 w-5 text-violet-600 dark:text-violet-300" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
