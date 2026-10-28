import type { BadgeTone } from "@starci/grammar/common"

/** One previewed row, every word already resolved. */
export interface ContractImportRowView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly problems: ReadonlyArray<{ readonly label: string; readonly tone: BadgeTone }>
}

/** One option of a select or a radio group. */
interface ContractImportOption {
    readonly id: string
    readonly label: string
}

/** One column picker: the contract field and the column chosen for it. */
interface ContractImportColumnView {
    readonly field: string
    readonly label: string
    readonly column: string
}

/** The words and state of the bulk contract import dialog. */
export interface ContractImportDialogView {
    readonly text: Readonly<
        Record<
            | "title"
            | "intro"
            | "close"
            | "cancel"
            | "source"
            | "fileLabel"
            | "filePrompt"
            | "pasteLabel"
            | "pasteHint"
            | "preview"
            | "sheet"
            | "mapping",
            string
        >
    >
    readonly source: string
    readonly sourceOptions: ReadonlyArray<ContractImportOption>
    readonly fileName: string | null
    readonly paste: string
    /** The workbook tabs to pick from; null for a single-tab source. */
    readonly sheets: ReadonlyArray<ContractImportOption> | null
    readonly sheet: string
    /** The column pickers once a preview is in; null before. */
    readonly columns: ReadonlyArray<ContractImportColumnView> | null
    readonly columnOptions: ReadonlyArray<ContractImportOption>
    /** "N rows, M will be imported" once a preview is in. */
    readonly summary: string | null
    readonly rows: ReadonlyArray<ContractImportRowView>
    readonly confirmLabel: string
    readonly canConfirm: boolean
    readonly isPreviewing: boolean
    readonly isImporting: boolean
    readonly error: string | null
}

/** The commands of the bulk contract import dialog. */
export interface ContractImportDialogEvents {
    readonly source: (value: string) => void
    readonly file: (files: Array<File>) => void
    readonly paste: (value: string) => void
    readonly preview: () => void
    readonly sheet: (value: string | null) => void
    readonly column: (field: string, column: string | null) => void
    readonly confirm: () => void
    readonly close: () => void
}
