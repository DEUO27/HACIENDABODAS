import * as XLSX from 'xlsx'
import { normalizeTelefono, normalizeCanalExcel, normalizeEventoExcel, cleanText } from './normalizers'
import { supabase } from '@/lib/supabase'
import { applyLeadImportTracking, createLeadImportTracking, LEAD_IMPORT_SOURCES } from './leadImportTracking'

// Funciones Auxiliares
function sha256_sync(string) {
    // A simple hash function for client-side stable hashing
    let hash = 0;
    if (string.length === 0) return hash.toString(16);
    for (let i = 0; i < string.length; i++) {
        const char = string.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

function buildDedupeKey(nombre, telefono, fechaEvento, fuente) {
    const rawArgs = `${cleanText(nombre)}|${telefono || ''}|${fechaEvento || ''}|${fuente}`
    return sha256_sync(rawArgs)
}

function formatLocalYMD(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function formatUtcYMD(date) {
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function convertExcelDateToISO(excelDate) {
    if (!excelDate) return null
    if (typeof excelDate === 'number') {
        // Excel serial dates are day-based values (no timezone semantics).
        // Convert from Excel epoch using UTC to keep day stable across timezones.
        const excelEpochUtcMs = Date.UTC(1899, 11, 30)
        const d = new Date(excelEpochUtcMs + Math.round(excelDate * 86400 * 1000))
        return formatUtcYMD(d)
    }
    if (excelDate instanceof Date) {
        return formatUtcYMD(excelDate)
    }
    // String formats
    const str = String(excelDate).trim()
    if (str.includes('/')) {
        // dd/mm/yyyy -> yyyy-mm-dd
        const parts = str.split('/')
        if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
    return str
}

/**
 * Procesa un ArrayBuffer de excel y devuelve el array crudo de objetos
 */
export async function readExcelFile(fileBuffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" })
    return jsonData
}

/**
 * Convierte filas parseadas de excel a formato validado y normalizado para Supabase Leads
 */
export function processExcelToLeads(excelRows, tracking = null) {
    const validLeads = []
    const invalidRows = []
    const importTracking = createLeadImportTracking(
        tracking?.fuente || LEAD_IMPORT_SOURCES.EXCEL_BODASCOM,
        tracking || {}
    )

    // Base timestamp for generating simple 8-digit IDs without uuid dependency
    const baseTimeStr = new Date().getTime().toString()

    excelRows.forEach((row, index) => {
        // Map common variable header names
        const findKey = (keywords) => {
            const keys = Object.keys(row)
            const k = keys.find(key => keywords.some(kw => key.toLowerCase().includes(kw)))
            return k ? row[k] : ''
        }

        const nombreRaw = findKey(['nombre', 'name'])
        const telRaw = findKey(['telefono', 'tel', 'phone'])
        const paxRaw = findKey(['pax', 'invitados', 'personas'])
        const eventoRaw = findKey(['evento', 'tipo'])
        const fechaAltaRaw = findKey(['fecha registro', 'fecha creacion', 'fechaAlta'])
        const fechaEventoRaw = findKey(['fecha evento', 'boda', 'fechaBoda'])

        const nombre = String(nombreRaw).trim()
        const telOriginal = telRaw ? String(telRaw).trim() : ''
        const telefono_normalizado = normalizeTelefono(telOriginal)

        // Validacion basica (debe tener nombre O telefono)
        if (!nombre && !telefono_normalizado) {
            invalidRows.push({ ...row, _error: 'Fila sin Nombre ni Telefono valido', _index: index })
            return
        }

        // Datos derivados
        const pax = parseInt(String(paxRaw).replace(/\D/g, '')) || null
        const fecha_evento = convertExcelDateToISO(fechaEventoRaw)
        // Use local calendar day as fallback to avoid UTC date rollover.
        const fecha_registro = convertExcelDateToISO(fechaAltaRaw) || formatLocalYMD(new Date())

        // Normalizacion
        const canalNorm = normalizeCanalExcel('', 'Bodas.com')
        const eventoNorm = normalizeEventoExcel(eventoRaw)

        // Dedupe
        const fuente = importTracking.fuente
        const dedupe_key = buildDedupeKey(nombre, telefono_normalizado, fecha_evento, fuente)

        // Generar un ID simple de 8 digitos al estilo de createLead, pero asegurando unicidad en el loop
        const uniqueSuffix = index.toString().padStart(3, '0')
        const fakeLeadId = String(Number(baseTimeStr.slice(-5) + uniqueSuffix))

        const finalLead = applyLeadImportTracking({
            lead_id: fakeLeadId,
            nombre: nombre || 'Sin Nombre',
            telefono: telOriginal || 'Sin Info',
            pax: pax,
            fase_embudo: 'Atendiendo',
            fecha_primer_mensaje: fecha_registro,
            fecha_evento: fecha_evento,

            // Excel default context
            canal_de_contacto: 'Sin Informacion',
            como_nos_encontro: 'Bodas.com',
            vendedora: 'Sin Asignar',
            salon: 'Sin Informacion',
            evento: eventoRaw ? String(eventoRaw).trim() : 'Sin Informacion',

            // Extracted from normalizers
            canal_base: canalNorm.canal_base,
            canal_normalizado: canalNorm.canal_normalizado,
            canal_razon: canalNorm.canal_razon,

            evento_base: eventoNorm.evento_base,
            evento_normalizado: eventoNorm.evento_normalizado,
            evento_razon: eventoNorm.evento_razon,

            // Tracking
            fuente: fuente,
            dedupe_key: dedupe_key
        }, importTracking)

        validLeads.push(finalLead)
    })

    return { validLeads, invalidRows }
}

/**
 * Inserta el array de leads de forma masiva en Supabase usando onConflict para evitar duplicados.
 */
export async function batchInsertLeadsDB(leadsArray, chunkSize = 200, onProgress = null, tracking = null) {
    let inserts = 0
    const total = leadsArray.length
    const totalBatches = Math.ceil(total / chunkSize)
    const importTracking = createLeadImportTracking(
        tracking?.fuente || LEAD_IMPORT_SOURCES.EXCEL_BODASCOM,
        tracking || {}
    )

    onProgress?.({
        processed: 0,
        total,
        inserted: 0,
        skipped: 0,
        currentBatch: 0,
        totalBatches,
    })

    for (let i = 0; i < leadsArray.length; i += chunkSize) {
        const chunk = leadsArray
            .slice(i, i + chunkSize)
            .map(lead => applyLeadImportTracking(lead, importTracking))
        const currentBatch = Math.floor(i / chunkSize) + 1

        // Using upsert with dedupe_key to skip existing
        const { data, error } = await supabase
            .from('leads')
            .upsert(chunk, {
                onConflict: 'dedupe_key',
                ignoreDuplicates: true
            })
            .select() // This returns ONLY the rows that were actually inserted (if ignored, it doesn't return them)

        if (error) {
            console.error('Batch insert error on chunk', i, error)
            throw new Error(`Error insertando lote ${i / chunkSize + 1}: ${error.message}`)
        }

        // Count how many we actually inserted
        if (data && data.length) {
            inserts += data.length
        }

        const processed = Math.min(i + chunk.length, total)

        onProgress?.({
            processed,
            total,
            inserted: inserts,
            skipped: processed - inserts,
            currentBatch,
            totalBatches,
        })
    }

    return {
        totalAttemped: total,
        totalInserted: inserts,
        totalSkipped: total - inserts
    }
}

