/** The contract fields a column can fill, in the order the dialog lists them. */
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

/** Where the contract rows come from. */
export type ContractImportSource = "file" | "paste"

/** Which column fills each field; null leaves it empty. */
export type ContractImportMapping = Readonly<Record<ContractImportField, string | null>>

/** What the import dialog holds: the source, the preview and the mapping the person edits. */
export interface ContractImportState<Preview> {
    readonly isOpen: boolean
    readonly source: ContractImportSource
    readonly file: File | null
    readonly paste: string
    readonly sheet: string | null
    readonly preview: Preview | null
    readonly mapping: ContractImportMapping | null
    readonly error: string | null
}

/** Initial closed dialog state before any contract source has been selected. */
export const CLOSED_CONTRACT_IMPORT: ContractImportState<never> = {
    isOpen: false,
    source: "file",
    file: null,
    paste: "",
    sheet: null,
    preview: null,
    mapping: null,
    error: null,
}

/** The seven columns of a mapping the back end answered, without anything else it carries. */
export const contractImportMappingOf = (
    raw: Partial<Record<ContractImportField, string | null>>,
): ContractImportMapping => ({
    customerName: raw.customerName ?? null,
    plan: raw.plan ?? null,
    startsOn: raw.startsOn ?? null,
    endsOn: raw.endsOn ?? null,
    amountVnd: raw.amountVnd ?? null,
    status: raw.status ?? null,
    note: raw.note ?? null,
})
