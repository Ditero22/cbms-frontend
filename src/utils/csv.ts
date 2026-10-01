export function escapeCsvCell(value: string) {
  // Prefix spreadsheet formulas before CSV quoting so cell contents are treated as text.
  const spreadsheetFormula = ['=', '+', '-', '@'].includes(value.trimStart().charAt(0))
  const safeValue = spreadsheetFormula ? `'${value}` : value
  return `"${safeValue.replaceAll('"', '""')}"`
}

export function serializeCsv(rows: string[][]) {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
}
