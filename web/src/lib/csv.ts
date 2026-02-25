import Papa from 'papaparse'

export function toCsv(rows: Record<string, unknown>[]) {
  return Papa.unparse(rows, {
    quotes: false,
    skipEmptyLines: false,
  })
}

export function downloadCsv(filename: string, csvText: string) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
