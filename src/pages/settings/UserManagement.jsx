import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import TemporaryPasswordDialog from '@/components/accounts/TemporaryPasswordDialog'
import { useAuth } from '@/contexts/AuthContext'
import {
  assignEventPlanner,
  deleteAccount,
  listAccounts,
  listEvents,
  resetAccountTemporaryPassword,
  upsertPlannerAccount,
} from '@/lib/eventService'

function InvitationPill({ status }) {
  const isConfirmed = status === 'confirmed'

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
      isConfirmed
        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
        : 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
    }`}>
      {isConfirmed ? 'Activo' : 'Pendiente'}
    </span>
  )
}

export default function UserManagement() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingMap, setSavingMap] = useState({})
  const [errorMessage, setErrorMessage] = useState('')
  const [noticeMessage, setNoticeMessage] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [plannerEmail, setPlannerEmail] = useState('')
  const [plannerName, setPlannerName] = useState('')
  const [dialogSaving, setDialogSaving] = useState(false)
  const [assignmentDrafts, setAssignmentDrafts] = useState({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState(null)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [passwordDialog, setPasswordDialog] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [resetSaving, setResetSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const [accountsData, eventsData] = await Promise.all([
        listAccounts(),
        listEvents(),
      ])

      setAccounts(accountsData)
      setEvents(eventsData)

      const nextAssignments = {}
      const plannerAssignments = new Map()

      for (const account of accountsData) {
        for (const assignment of account.assignments || []) {
          if (assignment.membershipRole === 'planner') {
            plannerAssignments.set(assignment.eventId, account.userId)
          }
        }
      }

      for (const event of eventsData) {
        nextAssignments[event.id] = plannerAssignments.get(event.id) || ''
      }

      setAssignmentDrafts(nextAssignments)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible cargar la configuracion de usuarios.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const plannerAccounts = useMemo(() => {
    return accounts.filter((account) => account.globalRole === 'planner')
  }, [accounts])

  async function handleCreatePlanner(event) {
    event.preventDefault()
    setDialogSaving(true)
    setErrorMessage('')
    setNoticeMessage('')

    try {
      const result = await upsertPlannerAccount({
        email: plannerEmail,
        fullName: plannerName,
      })

      const tempPassword = result?.access?.temporaryPassword
      if (tempPassword) {
        setPasswordDialog({
          email: result?.account?.email || plannerEmail,
          fullName: result?.account?.fullName || plannerName,
          temporaryPassword: tempPassword,
          isNewAccount: result?.access?.isNewAccount !== false,
        })
        setNoticeMessage('')
      } else {
        setNoticeMessage('Planner actualizado correctamente.')
      }

      setPlannerEmail('')
      setPlannerName('')
      setDialogOpen(false)
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible guardar la cuenta planner.')
    } finally {
      setDialogSaving(false)
    }
  }

  function openResetDialog(account) {
    setResetTarget(account)
  }

  async function handleConfirmReset() {
    if (!resetTarget) return
    setResetSaving(true)
    setErrorMessage('')
    setNoticeMessage('')

    try {
      const result = await resetAccountTemporaryPassword({ userId: resetTarget.userId })
      const tempPassword = result?.access?.temporaryPassword

      if (!tempPassword) {
        throw new Error('No se recibio la contrasena temporal generada.')
      }

      setPasswordDialog({
        email: result?.account?.email || resetTarget.email || '',
        fullName: result?.account?.fullName || resetTarget.fullName || '',
        temporaryPassword: tempPassword,
        isNewAccount: false,
      })
      setResetTarget(null)
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible regenerar la contrasena.')
    } finally {
      setResetSaving(false)
    }
  }

  async function handleAssignPlanner(eventId) {
    const plannerUserId = assignmentDrafts[eventId]

    if (!plannerUserId) {
      setErrorMessage('Selecciona un planner para asignarlo al evento.')
      return
    }

    setSavingMap((current) => ({ ...current, [eventId]: true }))
    setErrorMessage('')
    setNoticeMessage('')

    try {
      await assignEventPlanner(eventId, plannerUserId)
      setNoticeMessage('Planner asignado correctamente al evento.')
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible reasignar el planner.')
    } finally {
      setSavingMap((current) => ({ ...current, [eventId]: false }))
    }
  }

  function openDeleteDialog(account) {
    setAccountToDelete(account)
    setDeleteDialogOpen(true)
  }

  async function handleDeleteAccount() {
    if (!accountToDelete) {
      return
    }

    setDeleteSaving(true)
    setErrorMessage('')
    setNoticeMessage('')

    try {
      const result = await deleteAccount(accountToDelete.userId)
      const removedAssignments = Number(result?.removedAssignments || 0)
      const assignmentMessage = removedAssignments
        ? ` Tambien se quitaron ${removedAssignments} asignacion${removedAssignments === 1 ? '' : 'es'} de eventos.`
        : ''

      setNoticeMessage(`Cuenta eliminada correctamente.${assignmentMessage}`)
      setDeleteDialogOpen(false)
      setAccountToDelete(null)
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible eliminar la cuenta.')
    } finally {
      setDeleteSaving(false)
    }
  }

  return (
    <div className="space-y-8 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.3em]">
            Usuarios
          </Badge>
          <div>
            <h2 className="font-heading text-4xl text-foreground">Accesos y planners</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Crea planners, promueve cuentas existentes y controla que cada evento tenga el planner correcto.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-none" onClick={loadData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refrescar
          </Button>
          <Button className="rounded-none" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo planner
          </Button>
        </div>
      </div>

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

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-none border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Cuentas registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Asignaciones</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.userId}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{account.fullName || 'Sin nombre'}</p>
                        <p className="text-xs text-muted-foreground">{account.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm capitalize text-muted-foreground">{account.globalRole}</TableCell>
                    <TableCell><InvitationPill status={account.invitationStatus} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {account.assignments?.length
                        ? account.assignments
                          .map((assignment) => assignment.event?.name || 'Evento')
                          .join(', ')
                        : 'Sin eventos'}
                    </TableCell>
                    <TableCell className="text-right">
                      {account.globalRole === 'admin' || account.userId === user?.id ? (
                        <span className="text-xs text-muted-foreground">
                          {account.userId === user?.id ? 'Tu cuenta' : 'Protegida'}
                        </span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            className="rounded-none"
                            onClick={() => openResetDialog(account)}
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            Nueva contrasena
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-none border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/20"
                            onClick={() => openDeleteDialog(account)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && !accounts.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      Aun no hay cuentas administrativas registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Asignacion de planners</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="space-y-3 border border-border p-4">
                <div>
                  <p className="font-medium text-foreground">{event.name}</p>
                  <p className="text-xs text-muted-foreground">{event.venue || 'Sin sede definida'}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Select
                    value={assignmentDrafts[event.id] || ''}
                    onValueChange={(value) => {
                      setAssignmentDrafts((current) => ({
                        ...current,
                        [event.id]: value,
                      }))
                    }}
                  >
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

                  <Button
                    className="rounded-none"
                    onClick={() => handleAssignPlanner(event.id)}
                    disabled={Boolean(savingMap[event.id]) || !plannerAccounts.length}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {savingMap[event.id] ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </div>
            ))}

            {!loading && !events.length && (
              <div className="border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                Aun no hay eventos para asignar planners.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg rounded-none">
          <DialogHeader>
            <DialogTitle>Alta o promocion de planner</DialogTitle>
            <DialogDescription>
              Si el correo ya existe, la cuenta se promovera a planner. Si es nueva, se generara una contrasena temporal que aparecera en pantalla para que la compartas con el planner.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleCreatePlanner}>
            <div className="space-y-1.5">
              <Label htmlFor="planner-name">Nombre</Label>
              <Input
                id="planner-name"
                value={plannerName}
                onChange={(event) => setPlannerName(event.target.value)}
                placeholder="Nombre del planner"
                className="rounded-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="planner-email">Correo</Label>
              <Input
                id="planner-email"
                type="email"
                value={plannerEmail}
                onChange={(event) => setPlannerEmail(event.target.value)}
                placeholder="planner@email.com"
                className="rounded-none"
                required
              />
            </div>

            <DialogFooter>
              <Button type="submit" className="rounded-none" disabled={dialogSaving}>
                {dialogSaving ? 'Guardando...' : 'Guardar planner'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resetTarget)} onOpenChange={(next) => { if (!next) setResetTarget(null) }}>
        <DialogContent className="max-w-lg rounded-none">
          <DialogHeader>
            <DialogTitle>Generar contrasena temporal</DialogTitle>
            <DialogDescription>
              Esto invalidara la contrasena actual y obligara al usuario a definir una nueva al iniciar sesion.
            </DialogDescription>
          </DialogHeader>

          {resetTarget && (
            <div className="space-y-2 border border-border p-4 text-sm">
              <p className="font-medium text-foreground">{resetTarget.fullName || 'Sin nombre'}</p>
              <p className="text-muted-foreground">{resetTarget.email}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => setResetTarget(null)}
              disabled={resetSaving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-none"
              onClick={handleConfirmReset}
              disabled={resetSaving}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {resetSaving ? 'Generando...' : 'Generar contrasena'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemporaryPasswordDialog
        open={Boolean(passwordDialog)}
        onClose={() => setPasswordDialog(null)}
        email={passwordDialog?.email}
        fullName={passwordDialog?.fullName}
        temporaryPassword={passwordDialog?.temporaryPassword}
        isNewAccount={passwordDialog?.isNewAccount}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-lg rounded-none">
          <DialogHeader>
            <DialogTitle>Eliminar cuenta</DialogTitle>
            <DialogDescription>
              Esta accion eliminara la cuenta seleccionada y retirara sus accesos a eventos. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {accountToDelete && (
            <div className="space-y-2 border border-border p-4 text-sm">
              <p className="font-medium text-foreground">{accountToDelete.fullName || 'Sin nombre'}</p>
              <p className="text-muted-foreground">{accountToDelete.email}</p>
              <p className="text-muted-foreground">Rol: {accountToDelete.globalRole}</p>
              <p className="text-muted-foreground">
                Asignaciones: {accountToDelete.assignments?.length || 0}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => {
                setDeleteDialogOpen(false)
                setAccountToDelete(null)
              }}
              disabled={deleteSaving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-none"
              onClick={handleDeleteAccount}
              disabled={deleteSaving}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleteSaving ? 'Eliminando...' : 'Eliminar cuenta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
