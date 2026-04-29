function getExcelJS(module) {
  return module.default || module
}

const GUEST_TEMPLATE_LOGO_URL = '/logo.png'

async function fetchImageAsBase64(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load image asset: ${url}`)

  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return `data:image/png;base64,${btoa(binary)}`
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

const HEADER_KEYWORDS = ['nombre', 'telefono', 'email', 'grupo', 'mesa', 'etiqueta', 'rsvp', 'envio']

function normalizeHeaderText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function getHeaderScore(row = []) {
  const normalizedCells = row.map(normalizeHeaderText)
  return HEADER_KEYWORDS.reduce((score, keyword) => {
    return normalizedCells.some((cell) => cell.includes(keyword)) ? score + 1 : score
  }, 0)
}

function findHeaderRowIndex(matrix) {
  let bestIndex = 0
  let bestScore = 0

  matrix.slice(0, 20).forEach((row, index) => {
    const score = getHeaderScore(row)
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  return bestScore >= 3 ? bestIndex : 0
}

function matrixToDetectedObjects(matrix) {
  const headerRowIndex = findHeaderRowIndex(matrix)
  return matrixToObjects(matrix.slice(headerRowIndex))
}

function worksheetToMatrix(worksheet) {
  const matrix = []

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = []
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = normalizeCellValue(cell.value)
    })
    matrix.push(values)
  })

  return matrix
}

function pickWorksheet(workbook) {
  const invitadosWorksheet = workbook.worksheets.find((worksheet) => {
    return normalizeHeaderText(worksheet.name) === 'invitados'
  })

  if (invitadosWorksheet) return invitadosWorksheet

  return workbook.worksheets.find((worksheet) => {
    const matrix = worksheetToMatrix(worksheet)
    return getHeaderScore(matrix[findHeaderRowIndex(matrix)] || []) >= 3
  }) || workbook.worksheets[0]
}

export async function readSpreadsheetRows(fileBuffer) {
  try {
    const module = await import('exceljs')
    const ExcelJS = getExcelJS(module)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(fileBuffer)
    const worksheet = pickWorksheet(workbook)
    if (!worksheet) return []

    return matrixToDetectedObjects(worksheetToMatrix(worksheet))
  } catch {
    const text = new TextDecoder('utf-8').decode(fileBuffer)
    return matrixToDetectedObjects(parseCsv(text))
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

function setCellStyle(cell, style) {
  cell.style = JSON.parse(JSON.stringify(style))
}

function getGuestRowField(row, objectKey, columnIndex) {
  if (Array.isArray(row)) return row[columnIndex] || ''
  return row?.[objectKey] || ''
}

function normalizeSummaryText(value) {
  return String(value || '').trim().toLowerCase()
}

function buildGuestSummary(rows = []) {
  return rows.reduce((summary, row) => {
    const name = getGuestRowField(row, 'Nombre', 0)
    const phone = getGuestRowField(row, 'Telefono', 1)
    const rsvp = normalizeSummaryText(getGuestRowField(row, 'RSVP', 5))
    const delivery = normalizeSummaryText(getGuestRowField(row, 'Envio', 6))

    if (name || phone) summary.total += 1
    if (rsvp === 'confirmado') summary.confirmed += 1
    if (rsvp === 'pendiente' || !rsvp) summary.pending += 1
    if (rsvp === 'cancelado') summary.declined += 1
    if (delivery === 'entregado') summary.delivered += 1

    return summary
  }, {
    total: 0,
    confirmed: 0,
    pending: 0,
    declined: 0,
    delivered: 0,
  })
}

function buildWelcomeSheet(workbook, eventName, logoImageId, rows = []) {
  const worksheet = workbook.addWorksheet('Bienvenida')
  worksheet.views = [{
    showGridLines: false,
    showRowColHeaders: false,
    showRuler: true,
    zoomScale: 100,
    zoomScaleNormal: 100,
    activeCell: 'I3',
    selection: [{ activeCell: 'I3', sqref: 'I3' }],
  }]
  worksheet.columns = [
    { width: 6 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 6 },
  ]

  const welcomeRowHeights = {
    1: 20.1,
    2: 6,
    3: 75,
    4: 20.1,
    5: 9.95,
    6: 33.95,
    7: 27.95,
    8: 5.1,
    9: 8.1,
    10: 21.95,
    11: 15.95,
    12: 26.1,
    26: 14.1,
    27: 26.1,
  }

  for (let rowIndex = 13; rowIndex <= 25; rowIndex += 1) {
    welcomeRowHeights[rowIndex] = 20.1
  }
  for (let rowIndex = 28; rowIndex <= 32; rowIndex += 1) {
    welcomeRowHeights[rowIndex] = 21.95
  }
  for (let rowIndex = 33; rowIndex <= 54; rowIndex += 1) {
    welcomeRowHeights[rowIndex] = 20.1
  }

  for (let rowIndex = 1; rowIndex <= 54; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex)
    row.height = welcomeRowHeights[rowIndex] || 20.1
    for (let colIndex = 1; colIndex <= 6; colIndex += 1) {
      row.getCell(colIndex).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowIndex % 2 === 0 ? 'FFC4A882' : 'FFFDF9F3' },
      }
    }
  }

  if (logoImageId != null) {
    worksheet.addImage(logoImageId, {
      tl: { col: 2, row: 2 },
      ext: { width: 200, height: 98.2142782152231 },
      editAs: 'oneCell',
    })
  }

  const titleStyle = {
    font: { bold: true, size: 20, color: { argb: 'FF4A2C0A' }, name: 'Georgia' },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF9F3' } },
  }
  const subtitleStyle = {
    font: { bold: true, size: 13, color: { argb: 'FF7A4E1D' }, name: 'Georgia' },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF9F3' } },
  }
  const guideStyle = {
    font: { size: 11, color: { argb: 'FF4A2C0A' }, name: 'Arial' },
    alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF9F3' } },
  }
  const summaryLabelStyle = {
    font: { bold: true, size: 11, color: { argb: 'FF4A2C0A' }, name: 'Arial' },
    alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF9F3' } },
  }
  const summaryValueStyle = {
    font: { bold: true, size: 12, color: { argb: 'FF7A4E1D' }, name: 'Arial' },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF9F3' } },
  }

  worksheet.mergeCells('A6:F6')
  worksheet.mergeCells('A7:F7')
  worksheet.mergeCells('A10:F10')
  worksheet.mergeCells('A12:F12')
  worksheet.mergeCells('A27:F27')
  worksheet.getCell('A6').value = 'Bienvenido a la Plantilla de Invitados'
  worksheet.getCell('A7').value = eventName
  worksheet.getCell('A10').value = 'Navega a la hoja  Invitados  para gestionar tu lista'
  worksheet.getCell('A12').value = 'Guia de columnas'
  worksheet.getCell('A27').value = 'Resumen rapido'
  setCellStyle(worksheet.getCell('A6'), titleStyle)
  setCellStyle(worksheet.getCell('A7'), subtitleStyle)
  setCellStyle(worksheet.getCell('A10'), subtitleStyle)
  setCellStyle(worksheet.getCell('A12'), subtitleStyle)
  setCellStyle(worksheet.getCell('A27'), subtitleStyle)

  const guideRows = [
    '   Nombre   —   Nombre completo del invitado',
    '   Telefono   —   Con codigo de pais, ej. +52181...',
    '   Grupo   —   Numero o nombre del grupo',
    '   Mesa   —   Numero de mesa asignada',
    '   Etiquetas   —   VIP, Prensa, Staff, etc.',
    '   RSVP   —   Confirmado / Pendiente / Cancelado',
    '   Envio   —   Entregado / Pendiente / Sin enviar',
    '   Acompanantes   —   Cantidad de acompanantes permitidos',
    '   Comentario   —   Notas internas libres',
    '   Restricciones   —   Alergias o restricciones alimentarias',
    '   Fuente   —   manual / importado / web',
  ]

  guideRows.forEach((text, index) => {
    const rowNumber = 13 + index
    worksheet.mergeCells(`A${rowNumber}:F${rowNumber}`)
    worksheet.getCell(`A${rowNumber}`).value = text
    setCellStyle(worksheet.getCell(`A${rowNumber}`), guideStyle)
  })

  const summary = buildGuestSummary(rows)
  const summaryRows = [
    [28, 'Total invitados', 'SUMPRODUCT(--((Invitados!A3:A300&Invitados!B3:B300)<>""))', summary.total],
    [29, 'Confirmados', 'COUNTIF(Invitados!F3:F300,"Confirmado")', summary.confirmed],
    [30, 'Pendientes', 'COUNTIF(Invitados!F3:F300,"Pendiente")', summary.pending],
    [31, 'Cancelados', 'COUNTIF(Invitados!F3:F300,"Cancelado")', summary.declined],
    [32, 'Envios entregados', 'COUNTIF(Invitados!G3:G300,"Entregado")', summary.delivered],
  ]

  summaryRows.forEach(([rowNumber, text, formula, result]) => {
    worksheet.mergeCells(`A${rowNumber}:D${rowNumber}`)
    worksheet.mergeCells(`E${rowNumber}:F${rowNumber}`)
    worksheet.getCell(`A${rowNumber}`).value = text
    worksheet.getCell(`E${rowNumber}`).value = { formula, result }
    setCellStyle(worksheet.getCell(`A${rowNumber}`), summaryLabelStyle)
    setCellStyle(worksheet.getCell(`E${rowNumber}`), summaryValueStyle)
  })
}

function buildGuestWorksheet(workbook, { rows, eventName, logoImageId }) {
  const worksheet = workbook.addWorksheet('Invitados')
  const headers = ['Nombre', 'Telefono', 'Grupo', 'Mesa', 'Etiquetas', 'RSVP', 'Envio', 'Acompanantes', 'Comentario', 'Restricciones', 'Fuente']
  const widths = [24, 31.42578125, 10, 8, 14, 16, 16, 14, 28, 26, 14]
  const title = `   ${eventName}  —  Lista de Invitados`

  worksheet.views = [{
    state: 'frozen',
    ySplit: 2,
    topLeftCell: 'A3',
    showGridLines: false,
    showRuler: true,
    zoomScale: 100,
    zoomScaleNormal: 100,
    activeCell: 'A4',
  }]
  worksheet.columns = headers.map((header, index) => ({
    key: header,
    width: widths[index],
  }))

  worksheet.addRow(headers.map(() => title))
  worksheet.addRow(headers)
  worksheet.mergeCells('A1:K1')
  worksheet.getRow(1).height = 32.1
  worksheet.getRow(2).height = 26.1
  worksheet.autoFilter = 'A2:K2'

  if (logoImageId != null) {
    worksheet.addImage(logoImageId, {
      tl: { col: 8, row: 0 },
      ext: { width: 112, height: 55 },
      editAs: 'oneCell',
    })
  }

  const titleStyle = {
    font: { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Georgia' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A2C0A' } },
    alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
  }
  const headerStyle = {
    font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' }, name: 'Arial' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5A2B' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      left: { style: 'thin', color: { argb: 'FF4A2C0A' } },
      right: { style: 'thin', color: { argb: 'FF4A2C0A' } },
      top: { style: 'thin', color: { argb: 'FF4A2C0A' } },
      bottom: { style: 'thin', color: { argb: 'FF4A2C0A' } },
    },
  }
  const bodyStyle = {
    font: { size: 10, color: { argb: 'FF4A2C0A' }, name: 'Arial' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F3EC' } },
    alignment: { horizontal: 'left', vertical: 'middle' },
    border: {
      left: { style: 'thin', color: { argb: 'FFD4BC9A' } },
      right: { style: 'thin', color: { argb: 'FFD4BC9A' } },
      top: { style: 'thin', color: { argb: 'FFD4BC9A' } },
      bottom: { style: 'thin', color: { argb: 'FFD4BC9A' } },
    },
  }

  setCellStyle(worksheet.getCell('A1'), titleStyle)
  worksheet.getRow(2).eachCell((cell) => setCellStyle(cell, headerStyle))

  rows.forEach((row) => worksheet.addRow(row))

  const styleEndRow = Math.max(rows.length + 2, 199)
  for (let rowIndex = 3; rowIndex <= styleEndRow; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex)
    row.height = rowIndex <= rows.length + 2 ? 21.95 : 20.1
    headers.forEach((_, columnIndex) => {
      const cell = row.getCell(columnIndex + 1)
      setCellStyle(cell, bodyStyle)
      if (columnIndex + 1 !== 1 && columnIndex + 1 !== 9 && columnIndex + 1 !== 10) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      }
    })
  }

  for (let rowIndex = 3; rowIndex <= 300; rowIndex += 1) {
    worksheet.dataValidations.add(`F${rowIndex}`, {
      type: 'list',
      formulae: ['"Confirmado,Pendiente,Cancelado"'],
    })
    worksheet.dataValidations.add(`G${rowIndex}`, {
      type: 'list',
      formulae: ['"Entregado,Pendiente,Sin enviar"'],
    })
    worksheet.dataValidations.add(`K${rowIndex}`, {
      type: 'list',
      formulae: ['"manual,importado,web"'],
    })
  }
}

export async function downloadGuestTemplateSpreadsheet({ rows, eventName, filename, format = 'xlsx' }) {
  if (format === 'csv') {
    await downloadSpreadsheet({ rows, sheetName: 'Invitados', filename, format })
    return
  }

  const module = await import('exceljs')
  const ExcelJS = getExcelJS(module)
  const workbook = new ExcelJS.Workbook()
  const normalizedEventName = eventName || 'Evento'
  let logoImageId = null

  try {
    logoImageId = workbook.addImage({
      base64: await fetchImageAsBase64(GUEST_TEMPLATE_LOGO_URL),
      extension: 'png',
    })
  } catch (error) {
    console.warn('[Guest Export] Logo asset could not be embedded', error)
  }

  buildWelcomeSheet(workbook, normalizedEventName, logoImageId, rows)
  buildGuestWorksheet(workbook, { rows, eventName: normalizedEventName, logoImageId })

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
