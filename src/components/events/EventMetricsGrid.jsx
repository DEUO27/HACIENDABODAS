import { Baby, CalendarClock, CheckCircle2, Clock3, Send, Sparkles, UserPlus, Users, UsersRound, XCircle } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

function MetricCard({ label, value, icon, accent = 'text-foreground' }) {
  const Icon = icon
  return (
    <Card className="rounded-none border-border bg-card shadow-sm">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
        </div>
        <div className="rounded-none border border-border bg-secondary/40 p-3">
          <Icon className={`h-5 w-5 ${accent}`} />
        </div>
      </CardContent>
    </Card>
  )
}

function StageSection({ title, accent, metrics }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className={`inline-block h-2 w-2 rounded-full ${accent}`} />
        <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{title}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Confirmados" value={metrics.confirmed || 0} icon={CheckCircle2} accent="text-emerald-600 dark:text-emerald-300" />
        <MetricCard label="Rechazados" value={metrics.declined || 0} icon={XCircle} accent="text-rose-600 dark:text-rose-300" />
        <MetricCard label="Pendientes" value={metrics.pending || 0} icon={Clock3} accent="text-amber-600 dark:text-amber-300" />
        <MetricCard label="Total asistentes" value={metrics.totalAttendees || 0} icon={UsersRound} accent="text-fuchsia-600 dark:text-fuchsia-300" />
      </div>
    </div>
  )
}

export default function EventMetricsGrid({ metrics, scheduleCount = 0, selectedStage = 'confirmacion_1' }) {
  const stage1 = metrics.stage1 || {}
  const stage2 = metrics.stage2 || {}
  const final = metrics.final || {}

  const isFinalStage = selectedStage === 'confirmacion_2'
  const stageMetrics = isFinalStage ? stage2 : stage1
  const stageTitle = isFinalStage ? 'Confirmacion Final' : 'Confirmacion Inicial'
  const stageAccent = isFinalStage ? 'bg-sky-500' : 'bg-emerald-500'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total invitados" value={metrics.total || 0} icon={Users} />
        <MetricCard label="Invitaciones enviadas" value={metrics.sent || 0} icon={Send} accent="text-blue-600 dark:text-blue-300" />
        <MetricCard label="Programados" value={scheduleCount} icon={CalendarClock} accent="text-violet-600 dark:text-violet-300" />
        <MetricCard
          label="Asistentes finales"
          value={final.totalAttendees || 0}
          icon={Sparkles}
          accent="text-amber-600 dark:text-amber-300"
        />
      </div>

      <StageSection title={stageTitle} accent={stageAccent} metrics={stageMetrics} />

      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          label="Adultos extra"
          value={stageMetrics.adultCompanions || 0}
          icon={UserPlus}
          accent="text-cyan-600 dark:text-cyan-300"
        />
        <MetricCard
          label="Ninos extra"
          value={stageMetrics.childCompanions || 0}
          icon={Baby}
          accent="text-lime-600 dark:text-lime-300"
        />
      </div>
    </div>
  )
}
