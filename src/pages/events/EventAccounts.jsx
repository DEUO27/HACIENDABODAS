import { useCallback, useEffect, useMemo, useState } from 'react'
import { Mail, RefreshCw, Save, Trash2, UserPlus } from 'lucide-react'

import EventShellHeader from '@/components/events/EventShellHeader'
import { useAuth } from '@/contexts/AuthContext'
import { useEvent } from '@/contexts/EventContext'
import {
  assignEventPlanner,
  listAccounts,
  listEventAccounts,
  removeEventMembership,
  upsertEventCoupleAccount,
} from '@/lib/eventService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function AccountCard({ title, account, actions, description }) {
  return (
    <Card className="rounded-none border-border bg-card shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">{title}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </div>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
            {account ? 'Asignada' : 'Pendiente'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {account ? (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{account.full_name || 'Sin nombre'}</p>
            <p className="text-sm text-muted-foreground">{account.email}</p>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Aun no hay una cuenta asignada en este espacio.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {actions}
        </div>
      </CardContent>
    </Card>
  )
}

export default function EventAccounts() {
  const { role } = useAuth()
  const { events, event, eventId } = useEvent()
  const [accounts, setAccounts] = useState([])
  const [allAccounts, setAllAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [noticeMessage, setNoticeMessage] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogSlot, setDialogSlot] = useState(1)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [plannerSaving, setPlannerSaving] = useState(false)
  const [plannerDraft, setPlannerDraft] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const requests = [listEventAccounts(eventId)]

      if (role === 'admin') {
        requests.push(listAccounts())
      }

      const [eventAccounts, accountRegistry = []] = await Promise.all(requests)
      setAccounts(eventAccounts)
      setAllAccounts(accountRegistry)

      const currentPlanner = eventAccounts.find((item) => item.membership_role === 'planner')
      setPlannerDraft(currentPlanner?.user_id || '')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible cargar las cuentas del evento.')
    } finally {
      setLoading(false)
    }
  }, [eventId, role])

  useEffect(() => {
    if (eventId) {
      loadData()
    }
  }, [eventId, loadData])

  const plannerAccounts = useMemo(() => {
    return allAccounts.filter((account) => account.globalRole === 'planner')
  }, [allAccounts])

  const plannerAccount = useMemo(() => {
    return accounts.find((account) => account.membership_role === 'planner') || null
  }, [accounts])

  const spouseSlotOne = useMemo(() => {
    return accounts.find((account) => account.membership_role === 'esposos' && account.spouse_slot === 1) || null
  }, [accounts])

  const spouseSlotTwo = useMemo(() => {
    return accounts.find((account) => account.membership_role === 'esposos' && account.spouse_slot === 2) || null
  }, [accounts])

  function openSlotDialog(slot, currentAccount = null) {
    setDialogSlot(slot)
    setFullName(currentAccount?.full_name || '')
    setEmail(currentAccount?.email || '')
    setDialogOpen(true)
  }

  async function handleSaveCoupleAccount(event) {
    event.preventDefault()
    setSaving(true)
    setErrorMessage('')
    setNoticeMessage('')

    try {
      const result = await upsertEventCoupleAccount({
        eventId,
        fullName,
        email,
        spouseSlot: dialogSlot,
      })

      if (result?.invite?.sent === false && result?.invite?.error) {
        setNoticeMessage(result.invite.error)
      } else {
        setNoticeMessage('Cuenta de esposos guardada correctamente.')
      }

      setDialogOpen(false)
      setFullName('')
      setEmail('')
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible guardar la cuenta de esposos.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveAccount(userId) {
    setErrorMessage('')
    setNoticeMessage('')

    try {
      await removeEventMembership(eventId, userId)
      setNoticeMessage('Cuenta desvinculada correctamente del evento.')
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible quitar la cuenta del evento.')
    }
  }

  async function handleAssignPlanner() {
    if (!plannerDraft) {
      setErrorMessage('Selecciona un planner antes de guardar.')
      return
    }

    setPlannerSaving(true)
    setErrorMessage('')
    setNoticeMessage('')

    try {
      await assignEventPlanner(eventId, plannerDraft)
      setNoticeMessage('Planner asignado correctamente al evento.')
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible asignar el planner.')
    } finally {
      setPlannerSaving(false)
    }
  }

  return (
    <div className="space-y-6 py-6">
      <EventShellHeader
        events={events}
        currentEvent={event}
        activeTab="cuentas"
        actions={(
          <Button variant="outline" className="rounded-none" onClick={loadData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refrescar
          </Button>
        )}
      />

      {errorMessage && (
        <div className="rounded-none border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
          {errorMessage}
        </div>
      )}

      {noticeMessage && (
        <div className="rounded-none border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
          {noticeMessage}
        </div>
      )}

      {loading && (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={index} className="rounded-none border-border bg-card shadow-sm">
              <CardContent className="space-y-3 p-6">
                <div className="h-6 w-40 animate-pulse bg-secondary/60" />
                <div className="h-4 w-48 animate-pulse bg-secondary/40" />
                <div className="h-10 animate-pulse bg-secondary/30" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && (
      <>
      <Card className="rounded-none border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Planner del evento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {role === 'admin' ? (
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Select value={plannerDraft} onValueChange={setPlannerDraft}>
                <SelectTrigger className="rounded-none">
                  <SelectValue placeholder="Selecciona un planner" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  {plannerAccounts.map((planner) => (
                    <SelectItem key={planner.userId} value={planner.userId}>
                      {planner.fullName || planner.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button className="rounded-none" onClick={handleAssignPlanner} disabled={plannerSaving || !plannerAccounts.length}>
                <Save className="mr-2 h-4 w-4" />
                {plannerSaving ? 'Guardando...' : 'Asignar planner'}
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Este evento se encuentra asignado al planner actual.
            </div>
          )}

          <div className="rounded-none border border-border px-4 py-4">
            {plannerAccount ? (
              <div className="space-y-1">
                <p className="font-medium text-foreground">{plannerAccount.full_name || 'Sin nombre'}</p>
                <p className="text-sm text-muted-foreground">{plannerAccount.email}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aun no hay planner asignado a este evento.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <AccountCard
          title="Novio/a 1"
          account={spouseSlotOne}
          description="Cuenta principal de esposos para el primer acceso al evento."
          actions={(
            <>
              <Button className="rounded-none" onClick={() => openSlotDialog(1, spouseSlotOne)}>
                <UserPlus className="mr-2 h-4 w-4" />
                {spouseSlotOne ? 'Actualizar cuenta' : 'Agregar cuenta'}
              </Button>
              {spouseSlotOne && (
                <>
                  <Button
                    variant="outline"
                    className="rounded-none"
                    onClick={() => openSlotDialog(1, spouseSlotOne)}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Reenviar acceso
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-none"
                    onClick={() => handleRemoveAccount(spouseSlotOne.user_id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Quitar
                  </Button>
                </>
              )}
            </>
          )}
        />

        <AccountCard
          title="Novio/a 2"
          account={spouseSlotTwo}
          description="Segundo acceso de esposos para compartir el mismo evento."
          actions={(
            <>
              <Button className="rounded-none" onClick={() => openSlotDialog(2, spouseSlotTwo)}>
                <UserPlus className="mr-2 h-4 w-4" />
                {spouseSlotTwo ? 'Actualizar cuenta' : 'Agregar cuenta'}
              </Button>
              {spouseSlotTwo && (
                <>
                  <Button
                    variant="outline"
                    className="rounded-none"
                    onClick={() => openSlotDialog(2, spouseSlotTwo)}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Reenviar acceso
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-none"
                    onClick={() => handleRemoveAccount(spouseSlotTwo.user_id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Quitar
                  </Button>
                </>
              )}
            </>
          )}
        />
      </div>
      </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg rounded-none">
          <DialogHeader>
            <DialogTitle>{dialogSlot === 1 ? 'Cuenta Novio/a 1' : 'Cuenta Novio/a 2'}</DialogTitle>
            <DialogDescription>
              Si la cuenta ya existe, se vinculara a este evento y se reenviara el correo para definir o recuperar su contrasena.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSaveCoupleAccount}>
            <div className="space-y-1.5">
              <Label htmlFor="couple-name">Nombre</Label>
              <Input
                id="couple-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nombre de la cuenta"
                className="rounded-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="couple-email">Correo</Label>
              <Input
                id="couple-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="correo@evento.com"
                className="rounded-none"
                required
              />
            </div>

            <DialogFooter>
              <Button type="submit" className="rounded-none" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar y enviar acceso'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
