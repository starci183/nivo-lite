/** What the ImportBrainDossiers operation takes. */
export interface ImportBrainDossiersRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The file name of the checklist workbook, with its .xlsx extension. */
    readonly name: string
    /** The bytes of the workbook as base64. */
    readonly contentBase64: string
    /** The tab to read; the standard status tab when absent. */
    readonly sheet?: string | undefined
}
