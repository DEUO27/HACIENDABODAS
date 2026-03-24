import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

function isSinInfo(val) {
    return !val || val === 'Sin Informacion' || val.trim() === ''
}

function ValueBadge({ value }) {
    if (isSinInfo(value)) {
        return <Badge variant="outline" className="border-amber-700/50 bg-amber-950/30 text-amber-400">Sin Informacion</Badge>
    }
    return <span className="text-zinc-200">{value}</span>
}

export default function LeadDetailSheet({ lead, open, onClose }) {
    if (!lead) return null

    const entries = Object.entries(lead)

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent className="w-full sm:max-w-lg border-zinc-800 bg-zinc-950 overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="text-zinc-100">
                        Detalle del lead
                    </SheetTitle>
                    <p className="text-sm text-zinc-400">{lead.nombre || 'Sin nombre'}</p>
                </SheetHeader>

                <Separator className="my-4 bg-zinc-800" />

                <div className="space-y-3">
                    {entries.map(([key, value]) => (
                        <div key={key} className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                                {key.replace(/_/g, ' ')}
                            </span>
                            <ValueBadge value={String(value ?? '')} />
                        </div>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    )
}

