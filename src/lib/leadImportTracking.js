export const LEAD_IMPORT_SOURCES = {
  N8N_WEBHOOK_SISTEMAHACIENDA: 'n8n_webhook_sistemahacienda',
  MANUAL_DASHBOARD: 'manual_dashboard',
  EXCEL_BODASCOM: 'excel_bodascom',
}

function hasTrackingValue(value) {
  return value !== null && value !== undefined && value !== ''
}

function sanitizePrefix(prefix) {
  return String(prefix || 'lead_import')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function createLeadImportJobId(prefix = 'lead_import') {
  const safePrefix = sanitizePrefix(prefix)

  if (globalThis.crypto?.randomUUID) {
    return `${safePrefix}_${globalThis.crypto.randomUUID()}`
  }

  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '')
  const randomSuffix = Math.random().toString(36).slice(2, 10)
  return `${safePrefix}_${timestamp}_${randomSuffix}`
}

export function createLeadImportTracking(source, overrides = {}) {
  const safeSource = source || 'lead_import'
  const prefix = sanitizePrefix(safeSource) || 'lead_import'

  return {
    fuente: safeSource,
    created_at_import: overrides.created_at_import || new Date().toISOString(),
    import_job_id: overrides.import_job_id || createLeadImportJobId(prefix),
  }
}

export function applyLeadImportTracking(lead = {}, tracking = {}) {
  return {
    ...lead,
    fuente: hasTrackingValue(lead.fuente) ? lead.fuente : tracking.fuente ?? null,
    created_at_import: hasTrackingValue(lead.created_at_import) ? lead.created_at_import : tracking.created_at_import ?? null,
    import_job_id: hasTrackingValue(lead.import_job_id) ? lead.import_job_id : tracking.import_job_id ?? null,
  }
}

export function mergeLeadWithTracking(enrichedLead = {}, originalLead = {}, tracking = {}) {
  return applyLeadImportTracking(
    {
      ...originalLead,
      ...enrichedLead,
    },
    {
      fuente: hasTrackingValue(enrichedLead.fuente)
        ? enrichedLead.fuente
        : (hasTrackingValue(originalLead.fuente) ? originalLead.fuente : tracking.fuente),
      created_at_import: hasTrackingValue(enrichedLead.created_at_import)
        ? enrichedLead.created_at_import
        : (hasTrackingValue(originalLead.created_at_import) ? originalLead.created_at_import : tracking.created_at_import),
      import_job_id: hasTrackingValue(enrichedLead.import_job_id)
        ? enrichedLead.import_job_id
        : (hasTrackingValue(originalLead.import_job_id) ? originalLead.import_job_id : tracking.import_job_id),
    }
  )
}
