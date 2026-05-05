import { useState } from 'react'
import { AlertTriangle, Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

async function copyToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fallthrough to legacy method
    }
  }

  if (typeof document === 'undefined') return false

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(textarea)
  return ok
}

export default function TemporaryPasswordDialog({
  open,
  onClose,
  email,
  fullName,
  temporaryPassword,
  isNewAccount = true,
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!temporaryPassword) return
    const ok = await copyToClipboard(temporaryPassword)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleClose() {
    setCopied(false)
    onClose?.()
  }

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      handleClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg rounded-none">
        <DialogHeader>
          <DialogTitle>{isNewAccount ? 'Cuenta creada' : 'Contrasena regenerada'}</DialogTitle>
          <DialogDescription>
            Comparte esta contrasena con el usuario por un canal seguro. La pedira solo una vez y al iniciar sesion debera cambiarla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {(fullName || email) && (
            <div className="space-y-1 border border-border px-4 py-3 text-sm">
              {fullName && <p className="font-medium text-foreground">{fullName}</p>}
              {email && <p className="text-muted-foreground">{email}</p>}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Contrasena temporal
            </p>
            <div className="flex items-stretch gap-2">
              <div className="flex flex-1 items-center justify-center border border-border bg-secondary/40 px-4 py-3 font-mono text-lg tracking-widest text-foreground select-all">
                {temporaryPassword || '—'}
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-none px-4"
                onClick={handleCopy}
                disabled={!temporaryPassword}
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-3 border-l-4 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Solo se mostrara una vez. Si cierras este aviso sin copiarla, tendras que generar una nueva.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" className="rounded-none" onClick={handleClose}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
