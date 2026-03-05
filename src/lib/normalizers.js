/**
 * Funciones puras para normalizar datos importados.
 * Construido con reglas determinísticas basadas en la documentación de negocio.
 */

// Utilidad para checar si un string es válido
const isValInfo = (val) => {
    if (val === undefined || val === null) return false
    if (typeof val === 'string' && val.trim() === '') return false
    if (typeof val === 'string' && val.trim().toLowerCase() === 'sin informacion') return false
    if (typeof val === 'string' && val.trim().includes('se negó a brindar')) return false
    return true
}

// Limpiar un string quitando acentos y carácteres raros (bueno para comparar)
export const cleanText = (str) => {
    if (!str) return ''
    return str.toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, "") // quita acentos
        .toLowerCase()
        .trim()
}

/**
 * 1. Normalizador de Teléfono
 * Mantiene solo dígitos. Trata de mantener formato E.164 si es posible o 10 dígitos.
 */
export function normalizeTelefono(telRaw) {
    if (!isValInfo(telRaw)) return null

    let tel = String(telRaw).trim()

    // Remover texto y dejar solo numeros y símbolo +
    tel = tel.replace(/[^\d+]/g, '')

    if (tel === '' || tel === '+') return null

    return tel
}

/**
 * 2. Normalizador de Canal
 */
const CANALES_PERMITIDOS = [
    'Sin Informacion',
    'com.amocrm.amocrmwa',
    'WhatsApp',
    'Google',
    'TikTok',
    'Recomendación',
    'Instagram',
    'Facebook',
    'Redes sociales (otro)',
    'Otro'
]

export function normalizeCanalExcel(canal_de_contacto, como_nos_encontro) {
    let canal_base = 'Sin Informacion'

    // Determinar canal_base
    if (isValInfo(canal_de_contacto)) {
        canal_base = String(canal_de_contacto).trim()
    } else if (isValInfo(como_nos_encontro)) {
        canal_base = String(como_nos_encontro).trim()
    }

    if (!isValInfo(canal_base)) {
        return {
            canal_base: 'Sin Informacion',
            canal_normalizado: 'Sin Informacion',
            canal_razon: 'Sin_Info'
        }
    }

    const testStr = cleanText(canal_base)
    let canal_normalizado = 'Otro'
    let canal_razon = 'Fallback'

    // Reglas de prioridad
    if (canal_base.includes('com.amocrm.amocrmwa')) {
        canal_normalizado = 'com.amocrm.amocrmwa'
        canal_razon = 'ExactMatch'
    }
    else if (testStr.includes('whatsapp') || testStr.includes('wa')) {
        canal_normalizado = 'WhatsApp'
        canal_razon = 'Keyword_WhatsApp'
    }
    else if (testStr.includes('tiktok') || testStr.includes('tik tok')) {
        canal_normalizado = 'TikTok'
        canal_razon = 'Keyword_TikTok'
    }
    else if (testStr.includes('instagram') || testStr.includes('ig')) {
        canal_normalizado = 'Instagram'
        canal_razon = 'Keyword_Instagram'
    }
    else if (testStr.includes('facebook') || testStr.includes('face') || testStr.includes('fb')) {
        canal_normalizado = 'Facebook'
        canal_razon = 'Keyword_Facebook'
    }
    else if (testStr.includes('google') || testStr.includes('maps') || testStr.includes('buscador') || testStr.includes('busque')) {
        canal_normalizado = 'Google'
        canal_razon = 'Keyword_Google'
    }
    else if (testStr.includes('recomend') || testStr.includes('referid') || testStr.includes('amig') || testStr.includes('familiar')) {
        canal_normalizado = 'Recomendación'
        canal_razon = 'Keyword_Recomendacion'
    }
    else if (testStr.includes('redes') || testStr.includes('sociales')) {
        canal_normalizado = 'Redes sociales (otro)'
        canal_razon = 'Keyword_Redes'
    }
    else if (testStr === 'sin informacion' || canal_base === 'Sin Informacion') {
        canal_normalizado = 'Sin Informacion'
        canal_razon = 'Sin_Info_Explicita'
    }

    return {
        canal_base,
        canal_normalizado,
        canal_razon
    }
}

/**
 * 3. Normalizador de Evento
 */
const EVENTOS_PERMITIDOS = [
    'Graduación',
    'Boda',
    'Fiesta / Evento Social',
    'Evento Corporativo',
    'Evento Familiar',
    'Otro',
    'Sin Informacion'
]

export function normalizeEventoExcel(evento) {
    const evento_base = isValInfo(evento) ? String(evento).trim() : 'Sin Informacion'

    if (evento_base === 'Sin Informacion') {
        return {
            evento_base,
            evento_normalizado: 'Sin Informacion',
            evento_razon: 'Sin_Info'
        }
    }

    const testStr = cleanText(evento_base)
    let evento_normalizado = 'Otro'
    let evento_razon = 'Fallback'

    if (testStr.includes('boda')) {
        evento_normalizado = 'Boda'
        evento_razon = 'Keyword_Boda'
    }
    else if (testStr.includes('gradu') || testStr.includes('ibero')) {
        evento_normalizado = 'Graduación'
        evento_razon = 'Keyword_Graduacion'
    }
    else if (testStr.includes('corporativo') || testStr.includes('empresarial') || testStr.includes('empresa') || testStr.includes('fin de an')) {
        evento_normalizado = 'Evento Corporativo'
        evento_razon = 'Keyword_Corporativo'
    }
    else if (testStr.includes('bautizo') || testStr.includes('comunion') || testStr.includes('familiar') || testStr.includes('sesion') || testStr.includes('mama') || testStr.includes('papa')) {
        evento_normalizado = 'Evento Familiar'
        evento_razon = 'Keyword_Familiar'
    }
    else if (testStr.includes('xv') || testStr.includes('15') || testStr.includes('cumple') || testStr.includes('fiesta')) {
        evento_normalizado = 'Fiesta / Evento Social'
        evento_razon = 'Keyword_Fiesta'
    }
    else if (testStr.includes('hospedaje') || testStr.includes('hotel')) {
        evento_normalizado = 'Otro'
        evento_razon = 'Keyword_Hotel_Ignored'
    }

    return {
        evento_base,
        evento_normalizado,
        evento_razon
    }
}
