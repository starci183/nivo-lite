/** Where a dossier stands: present (held in full), partial, drafted (written, not yet signed), missing, or a template used when the need arises. */
export const DOSSIER_STATUSES = ["present", "partial", "drafted", "missing", "template"] as const

/** One of the statuses a dossier can have. */
export type DossierStatus = (typeof DOSSIER_STATUSES)[number]

/** The most dossiers one workspace tracks. */
export const DOSSIERS_MAX = 500

/** A dossier as the checklist describes it, before it is stored. */
export interface DossierInput {
    /** The reference documents name it by: the checklist number. */
    readonly ref: string
    /** The category label (the top folder without its number). */
    readonly category: string
    /** The number the category carries in its folder name. */
    readonly categoryOrder: number
    /** Where the row sits in the checklist. */
    readonly position: number
    /** The dossier's name. */
    readonly name: string
    /** Where it stands. */
    readonly status: DossierStatus
    /** The documents already held, or null. */
    readonly existing: string | null
    /** What is still missing, or null. */
    readonly missing: string | null
    /** The drafts already written, or null. */
    readonly drafts: string | null
}

/** A stored dossier as another capability reads it. */
export interface DossierEntry extends DossierInput {
    /** The dossier id. */
    readonly id: string
}

/** A dossier as the callers read it, with the documents that name it. */
export interface DossierRecord extends DossierInput {
    /** The dossier id. */
    readonly id: string
    /** How many documents of its category name its reference. */
    readonly documentCount: number
}

/** The columns of the checklist tab, by their position in a row; an optional column that is absent is -1. */
export interface SheetLayout {
    /** The row that holds the column titles. */
    readonly headerAt: number
    /** The reference (number) column. */
    readonly ref: number
    /** The category column. */
    readonly category: number
    /** The dossier name column. */
    readonly name: number
    /** The status column. */
    readonly status: number
    /** The documents-held column, or -1. */
    readonly existing: number
    /** The what-is-missing column, or -1. */
    readonly missing: number
    /** The drafts column, or -1. */
    readonly drafts: number
}

/** What the rows of a checklist tab hold: the dossiers it describes and how many rows it left out. */
export interface DossierSheet {
    /** The dossiers read, in sheet order. */
    readonly dossiers: ReadonlyArray<DossierInput>
    /** The rows that are not a numbered dossier of a known category and status. */
    readonly skipped: number
}

/** An uploaded checklist workbook. */
export interface DossierWorkbook {
    /** The file name, with its .xlsx extension. */
    readonly name: string
    /** The bytes of the file as base64. */
    readonly contentBase64: string
    /** The tab to read; the standard one when absent. */
    readonly sheet?: string | undefined
}

/** What an import did. */
export interface DossierImportResult {
    /** How many dossiers are stored after the import. */
    readonly imported: number
    /** How many rows were left out. */
    readonly skipped: number
    /** How many dossiers the workspace had that the checklist no longer names. */
    readonly removed: number
}
