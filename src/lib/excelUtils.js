function getExcelJS(module) {
  return module.default || module
}

function normalizeCellValue(value) {
  if (value == null) return ''
  if (value instanceof Date) return value
  if (typeof value !== 'object') return value
  if ('result' in value) return normalizeCellValue(value.result)
  if ('text' in value) return value.text || ''
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((item) => item.text || '').join('')
  }
  if ('hyperlink' in value && 'text' in value) return value.text || value.hyperlink || ''
  return String(value)
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1
      row.push(cell)
      if (row.some((value) => String(value || '').trim())) rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell)
  if (row.some((value) => String(value || '').trim())) rows.push(row)
  return rows
}

function matrixToObjects(matrix) {
  const [headerRow = [], ...dataRows] = matrix
  const headers = headerRow.map((header, index) => String(header || `Columna ${index + 1}`).trim())

  return dataRows.map((row) => {
    return headers.reduce((accumulator, header, index) => {
      accumulator[header] = normalizeCellValue(row[index])
      return accumulator
    }, {})
  })
}

export async function readSpreadsheetRows(fileBuffer) {
  try {
    const module = await import('exceljs')
    const ExcelJS = getExcelJS(module)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(fileBuffer)
    const worksheet = workbook.worksheets[0]
    if (!worksheet) return []

    const matrix = []
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = []
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        values[colNumber - 1] = normalizeCellValue(cell.value)
      })
      matrix.push(values)
    })

    return matrixToObjects(matrix)
  } catch {
    const text = new TextDecoder('utf-8').decode(fileBuffer)
    return matrixToObjects(parseCsv(text))
  }
}

function escapeCsvValue(value) {
  const normalized = value instanceof Date ? value.toISOString() : String(value ?? '')
  if (!/[",\r\n]/.test(normalized)) return normalized
  return `"${normalized.replace(/"/g, '""')}"`
}

function rowsToCsv(rows) {
  const headers = rows.length ? Object.keys(rows[0]) : []
  const lines = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ]
  return lines.join('\r\n')
}

export async function downloadSpreadsheet({ rows, sheetName, filename, format = 'xlsx' }) {
  if (format === 'csv') {
    const blob = new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' })
    triggerBrowserDownload(filename, blob)
    return
  }

  const module = await import('exceljs')
  const ExcelJS = getExcelJS(module)
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName)
  const headers = rows.length ? Object.keys(rows[0]) : []

  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.min(Math.max(String(header).length + 4, 12), 32),
  }))
  worksheet.addRows(rows)

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  triggerBrowserDownload(filename, blob)
}

export function triggerBrowserDownload(filename, blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
