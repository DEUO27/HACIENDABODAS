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
    const normalizedValue = value.replace(/\s+/g, ' ')

    try {
        const parsedIso = parseISO(normalizedValue.replace(' ', 'T'))
        if (isValid(parsedIso)) return parsedIso
    } catch {
        // fall through
    }

    const supportedFormats = [
        'dd/MM/yyyy HH:mm:ss',
        'dd/MM/yyyy H:mm:ss',
        'dd/MM/yyyy HH:mm',
        'dd/MM/yyyy H:mm',
        'dd/MM/yyyy',
        'dd-MM-yyyy HH:mm:ss',
        'dd-MM-yyyy H:mm:ss',
        'dd-MM-yyyy HH:mm',
        'dd-MM-yyyy H:mm',
        'dd-MM-yyyy',
        'yyyy-MM-dd HH:mm:ss',
        'yyyy-MM-dd H:mm:ss',
        'yyyy-MM-dd HH:mm',
        'yyyy-MM-dd H:mm',
        'yyyy-MM-dd',
    ]

    for (const format of supportedFormats) {
        try {
            const parsedDate = parse(normalizedValue, format, new Date())
            if (isValid(parsedDate)) return parsedDate
        } catch {
            // try next known format
        }
    }

    const fallbackDate = new Date(normalizedValue)
    return isValid(fallbackDate) ? fallbackDate : null
}

export function getLeadTrackingDate(lead) {
    const candidates = [
        lead?.fecha_primer_mensaje,
        lead?.fecha_de_creacion,
        lead?.created_at_import,
        lead?.created_at,
        lead?.Fecha,
        lead?.date,
    ]

    for (const candidate of candidates) {
        const parsed = parseLeadDate(candidate)
        if (parsed) return parsed
    }

    return null
}

export function normalizeCanal(val) {
    if (isSinInfo(val)) return 'Sin Informacion'

    const value = String(val).trim()
    const normalized = value.toLowerCase()

    if (normalized.includes('bodas.com') || normalized.includes('bodas.co')) return 'Bodas.com'
    if (value.includes('amocrmwa') || normalized.includes('whatsapp')) return 'WhatsApp'
    if (normalized.includes('instagram')) return 'Instagram'
    if (normalized.includes('facebook')) return 'Facebook'
    if (normalized.includes('llamada') || normalized.includes('call')) return 'Llamada'

    return value
}

export function safeDisplay(val) {
    return isSinInfo(val) ? 'Sin Informacion' : String(val).trim()
}
