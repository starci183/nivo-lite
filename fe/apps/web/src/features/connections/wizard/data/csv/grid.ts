import Papa from "papaparse"

export type Grid = { readonly headers: ReadonlyArray<string>; readonly rows: ReadonlyArray<ReadonlyArray<string>> }

export const MAX_GRID_ROWS = 1000

/** Text copied from Excel or Sheets (tab, comma or semicolon separated) -> grid; the first row holds the column names. */
export const gridFromText = (text: string): Grid | null => {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { delimitersToGuess: ["\t", ",", ";", "|"], skipEmptyLines: "greedy" })
  const all = parsed.data.filter((r) => r.some((c) => c.trim()))
  if (all.length === 0) return null
  const width = Math.max(...all.map((r) => r.length))
  const headers = Array.from({ length: width }, (_, i) => (all[0][i] ?? "").trim())
  const rows = all.slice(1).map((r) => headers.map((_, i) => (r[i] ?? "").trim()))
  return { headers, rows }
}

export const emptyGrid = (headers: ReadonlyArray<string>, rows = 3): Grid => ({ headers, rows: Array.from({ length: rows }, () => headers.map(() => "")) })

/** True when the grid has at least one filled cell below the header. */
export const gridHasRows = (g: Grid): boolean => g.rows.some((r) => r.some((c) => c.trim()))
