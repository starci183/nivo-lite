"use client"

import { useTranslations } from "next-intl"
import Papa from "papaparse"
import { useState } from "react"
import { MAX_GRID_ROWS } from "./csv-import-wizard.shared"
import type { CsvEntity, Grid } from "./csv-import-wizard.shared"

/** The catalog key of the starter columns of the typed grid for each kind of rows (column names joined by a bar). */
const STARTER_KEY = {
    customer: "starterCustomer",
    order: "starterOrder",
    product: "starterProduct",
    transaction: "starterTransaction",
    other: "starterOther",
} as const

const STARTER_ROWS = 3

let sequence = 0
const nextId = (prefix: string): string => {
    sequence += 1
    return `${prefix}${sequence}`
}

/** A grid of the given column names with a few empty rows; `prefix` keeps the ids of the first grid stable across renders. */
const emptyGrid = (headers: ReadonlyArray<string>, prefix: string | null): Grid => ({
    columns: headers.map((name, at) => ({ id: prefix === null ? nextId("c") : `${prefix}c${at}`, name })),
    rows: Array.from({ length: STARTER_ROWS }, (_, at) => ({
        id: prefix === null ? nextId("r") : `${prefix}r${at}`,
        cells: headers.map(() => ""),
    })),
})

/** Text copied from Excel or Sheets (tab, comma, semicolon or bar separated) as a grid; the first row holds the column names. */
const gridFromText = (text: string): Grid | null => {
    const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
        delimitersToGuess: ["\t", ",", ";", "|"],
        skipEmptyLines: "greedy",
    })
    const all = parsed.data.filter((row) => row.some((cell) => cell.trim()))
    if (all.length === 0) return null
    const width = Math.max(...all.map((row) => row.length))
    const headers = Array.from({ length: width }, (_, at) => (all[0]?.[at] ?? "").trim())
    return {
        columns: headers.map((name) => ({ id: nextId("c"), name })),
        rows: all.slice(1, MAX_GRID_ROWS + 1).map((row) => ({
            id: nextId("r"),
            cells: headers.map((_, at) => (row[at] ?? "").trim()),
        })),
    }
}

/** True when the grid has at least one filled cell below the header. */
const gridHasRows = (grid: Grid): boolean => grid.rows.some((row) => row.cells.some((cell) => cell.trim()))

/** What the grid starts from: the saved columns when resuming, else the starter columns of customers. */
interface CsvImportGridInput {
    /** The saved import's columns; null for a new import (or while the saved import loads). */
    readonly savedColumns: ReadonlyArray<string> | null
}

/**
 * The typed grid of the import wizard and the text pasted into it. Until it is edited the grid is derived from the saved import (or
 * the starter columns), so it follows the saved import once that has loaded.
 */
export const useCsvImportGrid = (input: CsvImportGridInput) => {
    const t = useTranslations("connectorCsv")
    const [edited, setEdited] = useState<Grid | null>(null)
    const [paste, setPaste] = useState("")
    const starter = (kind: keyof typeof STARTER_KEY) => t(STARTER_KEY[kind]).split("|")
    const savedColumns = input.savedColumns?.length ? input.savedColumns : starter("other")
    const grid = edited ?? emptyGrid(input.savedColumns === null ? starter("customer") : savedColumns, "s")
    const change = (next: (current: Grid) => Grid) => setEdited((current) => next(current ?? grid))
    return {
        grid,
        paste,
        hasRows: gridHasRows(grid),
        /** The grid as the back end reads it: the column names and the rows of cells. */
        source: { headers: grid.columns.map((column) => column.name), rows: grid.rows.map((row) => row.cells) },
        /** Starts the empty grid again from the starter columns of another kind of rows. */
        restart: (entity: Exclude<CsvEntity, "document">) => {
            if (!gridHasRows(grid)) setEdited(emptyGrid(starter(entity), null))
        },
        on: {
            paste: setPaste,
            applyPaste: () => {
                const pasted = gridFromText(paste)
                if (!pasted) return
                setEdited(pasted)
                setPaste("")
            },
            rename: (columnId: string, name: string) =>
                change((current) => ({
                    ...current,
                    columns: current.columns.map((column) => (column.id === columnId ? { ...column, name } : column)),
                })),
            cell: (rowId: string, columnId: string, value: string) =>
                change((current) => {
                    const at = current.columns.findIndex((column) => column.id === columnId)
                    return {
                        ...current,
                        rows: current.rows.map((row) =>
                            row.id === rowId
                                ? { ...row, cells: row.cells.map((cell, i) => (i === at ? value : cell)) }
                                : row,
                        ),
                    }
                }),
            addRow: () =>
                change((current) => ({
                    ...current,
                    rows: [...current.rows, { id: nextId("r"), cells: current.columns.map(() => "") }],
                })),
            removeRow: (rowId: string) =>
                change((current) => ({ ...current, rows: current.rows.filter((row) => row.id !== rowId) })),
            addColumn: () =>
                change((current) => ({
                    columns: [...current.columns, { id: nextId("c"), name: "" }],
                    rows: current.rows.map((row) => ({ ...row, cells: [...row.cells, ""] })),
                })),
        },
    }
}
