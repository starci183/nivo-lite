import type { ContractImportField } from "@modules/domain/data-hub"

/** What previewing a contract import takes: the file or the pasted text, and the mapping once the person edits it. */
export interface PreviewContractImportRequest {
    /** The workspace the caller acts in, named in X-Workspace-Id. */
    readonly workspaceId: string
    /** The uploaded .csv or .xlsx; it wins over the text. */
    readonly file?: { readonly name: string; readonly contentBase64: string } | null
    /** The workbook tab to read. */
    readonly sheet?: string | null
    /** The pasted table text. */
    readonly text?: string | null
    /** The chosen mapping; null suggests one from the headers. */
    readonly mapping?: Partial<Record<ContractImportField, string | null>> | null
}
