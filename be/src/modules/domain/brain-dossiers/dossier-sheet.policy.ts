import { DOSSIER_STATUSES } from "./brain-dossiers.contracts"
import type { DossierInput, DossierSheet, DossierStatus, SheetLayout } from "./brain-dossiers.contracts"
import { DOSSIER_CHECKLIST_WORDS } from "./messages/dossier-checklist.messages"

const WORDS = DOSSIER_CHECKLIST_WORDS

/** The words of a status cell, by status. */
const STATUS_WORDS: ReadonlyArray<readonly [DossierStatus, string]> = DOSSIER_STATUSES.map(
    (status): readonly [DossierStatus, string] => [status, WORDS.statuses[status]],
)

/** The words of a cell compared without case, composition of accents or repeated spaces. */
const wordsOf = (cell: string): string => cell.normalize("NFC").replace(/\s+/gu, " ").trim().toLowerCase()

/** The number and separator in front of a folder name ("01. LEGAL FILES"); what follows is the label the documents carry as their topic. */
const CATEGORY_PREFIX = /^\s*\d+\s*[.)\-–:]\s*/u

/** The column whose title starts with the given words, or -1. */
const columnStarting = (header: ReadonlyArray<string>, words: string): number =>
    header.findIndex((cell) => wordsOf(cell).startsWith(words))

/** The column titled exactly with the given words, or -1. */
const columnTitled = (header: ReadonlyArray<string>, words: string): number =>
    header.findIndex((cell) => wordsOf(cell) === words)

const layoutOfRow = (header: ReadonlyArray<string>, headerAt: number): SheetLayout => ({
    headerAt,
    ref: columnTitled(header, WORDS.columns.ref),
    category: columnTitled(header, WORDS.columns.category),
    name: columnTitled(header, WORDS.columns.name),
    status: columnTitled(header, WORDS.columns.status),
    existing: columnStarting(header, WORDS.columns.existing),
    missing: columnStarting(header, WORDS.columns.missing),
    drafts: columnStarting(header, WORDS.columns.drafts),
})

/** Where the checklist columns are: the first row that names the reference, category, dossier and status columns; null when no row does. */
export const layoutOf = (cells: ReadonlyArray<ReadonlyArray<string>>): SheetLayout | null => {
    for (const [index, row] of cells.entries()) {
        const layout = layoutOfRow(row, index)
        if (Math.min(layout.ref, layout.category, layout.name, layout.status) >= 0) return layout
    }
    return null
}

/** The status a checklist cell means (a template cell may add words after its own); null for words that are none of the five. */
export const statusOf = (cell: string): DossierStatus | null => {
    const words = wordsOf(cell)
    const known = STATUS_WORDS.find(([, status]) => words === status || words.startsWith(`${status} `))
    return known === undefined ? null : known[0]
}

/** The number and the label of a category cell; null when it carries no number or no label. */
const categoryOf = (cell: string | null): { readonly order: number; readonly label: string } | null => {
    if (cell === null || !CATEGORY_PREFIX.test(cell)) return null
    const label = cell.replace(CATEGORY_PREFIX, "").trim().slice(0, 80)
    return label === "" ? null : { order: Number.parseInt(cell, 10), label }
}

const textAt = (row: ReadonlyArray<string>, column: number): string | null => {
    const text = (column < 0 ? "" : (row[column] ?? "")).trim()
    return text === "" ? null : text
}

const dossierOf = (row: ReadonlyArray<string>, layout: SheetLayout, position: number): DossierInput | null => {
    const ref = textAt(row, layout.ref)
    const category = categoryOf(textAt(row, layout.category))
    const name = textAt(row, layout.name)
    const status = statusOf(textAt(row, layout.status) ?? "")
    if (ref === null || !/^\d+$/u.test(ref) || category === null || name === null || status === null) return null
    return {
        ref: String(Number(ref)),
        category: category.label,
        categoryOrder: category.order,
        position,
        name,
        status,
        existing: textAt(row, layout.existing),
        missing: textAt(row, layout.missing),
        drafts: textAt(row, layout.drafts),
    }
}

/**
 * The dossiers under the header row of the checklist: a row with a number in the reference column, a numbered category, a name and one
 * of the five statuses. Any other row that holds something (an optional dossier marked with letters instead of a number, a note) is
 * counted as skipped; a blank row is not.
 */
export const dossiersOf = (cells: ReadonlyArray<ReadonlyArray<string>>, layout: SheetLayout): DossierSheet => {
    const dossiers: Array<DossierInput> = []
    let skipped = 0
    for (const row of cells.slice(layout.headerAt + 1)) {
        if (row.every((cell) => cell.trim() === "")) continue
        const dossier = dossierOf(row, layout, dossiers.length + 1)
        if (dossier === null) skipped += 1
        else dossiers.push(dossier)
    }
    return { dossiers, skipped }
}
