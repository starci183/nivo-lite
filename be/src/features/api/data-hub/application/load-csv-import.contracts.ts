/** What loadCsvImport takes. */
export interface LoadCsvImportRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The import to read back. */
    readonly connectionId: string
}
