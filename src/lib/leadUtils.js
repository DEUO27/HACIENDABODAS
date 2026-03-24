import { parseISO, parse, isValid } from 'date-fns'

function normalizeText(value) {
    return String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

export function isSinInfo(val) {
    if (!val) return true
    const normalized = normalizeText(val)
    return normalized === '' || normalized === 'sin informacion'
}

export function parseLeadDate(raw) {
    if (!raw || isSinInfo(raw)) return null

    const value = String(raw).trim()

    try {
        const parsedIso = parseISO(value.replace(' ', 'T'))
        if (isValid(parsedIso)) return parsedIso
    } catch {
        // fall through
    }

    try {
        const parsedDate = parse(value, 'dd/MM/yyyy', new Date())
        if (isValid(parsedDate)) return parsedDate
    } catch {
        // fall through
    }

    const fallbackDate = new Date(value)
    return isValid(fallbackDate) ? fallbackDate : null
}

export function normalizeCanal(val) {
    if (isSinInfo(val)) return 'Sin Informacion'

    const value = String(val).trim()
    const normalized = value.toLowerCase()

    if (value.includes('amocrmwa') || normalized.includes('whatsapp')) return 'WhatsApp'
    if (normalized.includes('instagram')) return 'Instagram'
    if (normalized.includes('facebook')) return 'Facebook'
    if (normalized.includes('llamada') || normalized.includes('call')) return 'Llamada'

    return value
}

export function safeDisplay(val) {
    return isSinInfo(val) ? 'Sin Informacion' : String(val).trim()
}
