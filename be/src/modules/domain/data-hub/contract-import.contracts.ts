import type { LinkedCustomers } from "@modules/domain/contracts"
import type { CsvUploadedFile } from "./csv-import.contracts"

/** The contract fields a column can fill. */
export const CONTRACT_IMPORT_FIELDS = [
    "customerName",
    "plan",
    "startsOn",
    "endsOn",
    "amountVnd",
    "status",
    "note",
] as const

/** One contract field a column can fill. */
export type ContractImportField = (typeof CONTRACT_IMPORT_FIELDS)[number]

/** Which column fills each contract field; null leaves the field empty. */
export type ContractImportMapping = Readonly<Record<ContractImportField, string | null>>

/** Why one row cannot be imported, or what was guessed about it. */
export const CONTRACT_IMPORT_PROBLEMS = [
    "customerMissing",
    "endsOnMissing",
    "endsOnInvalid",
    "startsOnInvalid",
    "datesReversed",
    "amountInvalid",
    "duplicate",
    "startsOnDerived",
] as const

/** One code of CONTRACT_IMPORT_PROBLEMS. */
export type ContractImportProblem = (typeof CONTRACT_IMPORT_PROBLEMS)[number]

/** Where the contract rows come from: an uploaded .csv or .xlsx (with an optional tab), else pasted text. */
export interface ContractImportSource {
    /** The workspace the caller acts in. */
    readonly workspaceId: string
    /** The signed-in caller. */
    readonly userId: string
    /** The uploaded file; when present it wins over the text. */
    readonly file?: CsvUploadedFile | null
    /** The workbook tab to read. */
    readonly sheet?: string | null
    /** The pasted table text. */
    readonly text?: string | null
}

/** What previewing an import takes: the source and, after the person edits it, the mapping to judge the rows with. */
export interface ContractImportPreviewRequest extends ContractImportSource {
    /** The chosen mapping; null suggests one from the headers. */
    readonly mapping?: Partial<Record<ContractImportField, string | null>> | null
}

/** What importing contracts takes: the source and the chosen mapping. */
export interface ContractImportRequest extends ContractImportSource {
    /** The chosen mapping, checked against the real headers. */
    readonly mapping: Partial<Record<ContractImportField, string | null>>
    /** The `Accept-Language` header of the request, for the evidence line of each saved contract. */
    readonly acceptLanguage: string | undefined
}

/** One data row read as a contract, with what is wrong with it. */
export interface ContractImportRow {
    /** The row number in the sheet (the header row is 1). */
    readonly row: number
    /** The customer name. */
    readonly customerName: string
    /** The plan. */
    readonly plan: string
    /** The first day, YYYY-MM-DD; null when it cannot be read. */
    readonly startsOn: string | null
    /** The last day, YYYY-MM-DD; null when it is missing or cannot be read. */
    readonly endsOn: string | null
    /** The amount in whole dong; null when empty or unreadable. */
    readonly amountVnd: number | null
    /** `active`, `ended` or `cancelled`. */
    readonly status: string
    /** The note, with the derived start flagged. */
    readonly note: string
    /** The problem codes; any code but `startsOnDerived` keeps the row out. */
    readonly problems: ReadonlyArray<ContractImportProblem>
}

/** What previewing an import answers before anything is saved. */
export interface ContractImportPreview {
    /** The column names. */
    readonly headers: ReadonlyArray<string>
    /** The workbook tab names (empty for other sources). */
    readonly sheets: ReadonlyArray<string>
    /** The tab that was read. */
    readonly sheet: string
    /** The mapping the rows were judged with. */
    readonly mapping: ContractImportMapping
    /** The first rows, judged. */
    readonly rows: ReadonlyArray<ContractImportRow>
    /** How many data rows there are. */
    readonly total: number
    /** How many rows would be saved. */
    readonly ready: number
}

/** One row left out of an import. */
export interface ContractImportSkip {
    /** The row number in the sheet. */
    readonly row: number
    /** The problem code, or the refusal code of the contracts capability. */
    readonly reason: string
}

/** What importing contracts answers. */
export interface ContractImportResult {
    /** How many contracts were saved. */
    readonly created: number
    /** The rows left out, each with its reason. */
    readonly skipped: ReadonlyArray<ContractImportSkip>
    /**
     * What linking the contracts to their customers did right after the save: how many reach a lead now, how many leads were
     * created and which contracts still reach nobody.
     */
    readonly customers: LinkedCustomers
}
