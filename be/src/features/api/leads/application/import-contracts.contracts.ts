import type { ContractImportField } from "@modules/domain/data-hub"

/** What importing contracts takes: the file or the pasted text and the chosen mapping. */
export interface ImportContractsRequest {
    /** The workspace the caller acts in, named in X-Workspace-Id. */
    readonly workspaceId: string
    /** The uploaded .csv or .xlsx; it wins over the text. */
    readonly file?: { readonly name: string; readonly contentBase64: string } | null
    /** The workbook tab to read. */
    readonly sheet?: string | null
    /** The pasted table text. */
    readonly text?: string | null
    /** The chosen mapping. */
    readonly mapping: Partial<Record<ContractImportField, string | null>>
    /** The `Accept-Language` header of the request; each evidence line uses the language it names. */
    readonly acceptLanguage: string | undefined
}
