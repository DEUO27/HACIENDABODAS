import { parseISO, parse, isValid } from 'date-fns'

/**
 * Normalize "Sin Informacion", "Sin información", empty, null → true
 */
export function isSinInfo(val) {
    if (!val) return true
    const s = String(val).trim().toLowerCase()
    return s === '' || s === 'sin informacion' || s === 'sin información'
}

/**
 * Parse dates that may come in multiple formats:
 * - "YYYY-MM-DD HH:MM:SS.000"
 * - "YYYY-MM-DDTHH:MM:SS"
 * - "DD/MM/YYYY"
 * - ISO 8601
 * Returns a Date or null if unparsable / missing.
 */
export function parseLeadDate(raw) {
    if (!raw || isSinInfo(raw)) return null

    const s = String(raw).trim()

    // Try ISO first (covers "YYYY-MM-DDTHH:MM:SS" and "YYYY-MM-DD HH:MM:SS.000")
    try {
        const d = parseISO(s.replace(' ', 'T'))
        if (isValid(d)) return d
    } catch {
        // fall through
    }

    // Try DD/MM/YYYY
    try {
        const d = parse(s, 'dd/MM/yyyy', new Date())
        if (isValid(d)) return d
    } catch {
        // fall through
    }

    // Try native Date constructor as last resort
    const d = new Date(s)
    return isValid(d) ? d : null
}

/**
 * Normalize canal values — group exact matches, mark empties as missing
 */
export function normalizeCanal(val) {
    if (isSinInfo(val)) return 'Sin Información'
    const s = String(val).trim()
    // Map common CRM identifiers
    if (s.includes('amocrmwa') || s.toLowerCase().includes('whatsapp')) return 'WhatsApp'
    if (s.toLowerCase().includes('instagram')) return 'Instagram'
    if (s.toLowerCase().includes('facebook')) return 'Facebook'
    if (s.toLowerCase().includes('llamada') || s.toLowerCase().includes('call')) return 'Llamada'
    return s
}

/**
 * Returns a display-safe string — "Sin Información" if missing
 */
export function safeDisplay(val) {
    return isSinInfo(val) ? 'Sin Información' : String(val).trim()
}
