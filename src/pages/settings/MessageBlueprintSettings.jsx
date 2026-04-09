import { useCallback, useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { MESSAGE_BLUEPRINT_CATALOG } from '@/lib/eventModuleUtils'
import { listMessageBlueprints, saveMessageBlueprint } from '@/lib/eventService'

function buildFormState(rows) {
  const existingByKey = new Map(rows.map((row) => [row.message_key, row]))

  return MESSAGE_BLUEPRINT_CATALOG.map((preset) => {
    const existing = existingByKey.get(preset.key)

    return {
      id: existing?.id || null,
      message_key: preset.key,
      label: existing?.label || preset.label,
      meta_template_name: existing?.meta_template_name || '',
      language_code: existing?.language_code || 'es_MX',
      reference_body: existing?.reference_body || preset.referenceBody,
      is_active: Boolean(existing?.is_active),
      description: preset.description,
    }
  })
}

export default function MessageBlueprintSettings() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState('')
  const [notice, setNotice] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const loadBlueprints = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const data = await listMessageBlueprints()
      setRows(buildFormState(data))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible cargar la configuracion de mensajes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBlueprints()
  }, [loadBlueprints])

  const activeCount = useMemo(() => rows.filter((row) => row.is_active).length, [rows])

  async function handleSave(row) {
    setSavingKey(row.message_key)
    setErrorMessage('')

    try {
      await saveMessageBlueprint(row)
      setNotice(`Configuracion guardada para ${row.label}.`)
      await loadBlueprints()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible guardar la configuracion.')
    } finally {
      setSavingKey('')
    }
  }

  return (
    <div className="space-y-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.3em]">
            Configuracion interna
          </Badge>
          <div>
            <h2 className="font-heading text-4xl text-foreground">Mensajes de WhatsApp</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Define los templates reales de Meta que usara el wizard para los esposos. Esta pantalla no se muestra en el flujo principal del evento.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="rounded-full px-3 py-1 uppercase tracking-[0.2em]">
          {activeCount} activos
        </Badge>
      </div>

      {notice && (
        <div className="rounded-none border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-none border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {(loading ? buildFormState([]) : rows).map((row) => (
          <Card key={row.message_key} className="rounded-none border-border bg-card shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">{row.label}</CardTitle>
                  <CardDescription className="mt-2 text-sm text-muted-foreground">
                    {row.description}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="rounded-full px-3 py-1 uppercase tracking-[0.2em]">
                    {row.message_key}
                  </Badge>
                  <Switch
                    checked={row.is_active}
                    onCheckedChange={(checked) => {
                      setRows((current) => current.map((item) => (
                        item.message_key === row.message_key
                          ? { ...item, is_active: checked }
                          : item
                      )))
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Nombre del template en Meta</span>
                <Input
                  value={row.meta_template_name}
                  onChange={(event) => {
                    const value = event.target.value
                    setRows((current) => current.map((item) => (
                      item.message_key === row.message_key
                        ? { ...item, meta_template_name: value }
                        : item
                    )))
                  }}
                  className="rounded-none"
                  placeholder="hb_invitacion_principal"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Idioma</span>
                <Input
                  value={row.language_code}
                  onChange={(event) => {
                    const value = event.target.value
                    setRows((current) => current.map((item) => (
                      item.message_key === row.message_key
                        ? { ...item, language_code: value }
                        : item
                    )))
                  }}
                  className="rounded-none"
                  placeholder="es_MX"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Cuerpo de referencia</span>
                <textarea
                  value={row.reference_body}
                  onChange={(event) => {
                    const value = event.target.value
                    setRows((current) => current.map((item) => (
                      item.message_key === row.message_key
                        ? { ...item, reference_body: value }
                        : item
                    )))
                  }}
                  className="min-h-40 w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </label>
              <Button
                className="w-full rounded-none"
                onClick={() => handleSave(row)}
                disabled={savingKey === row.message_key}
              >
                <Save className="mr-2 h-4 w-4" />
                {savingKey === row.message_key ? 'Guardando...' : 'Guardar configuracion'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
