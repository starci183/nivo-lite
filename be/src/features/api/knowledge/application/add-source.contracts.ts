/** What add source takes. */
export interface AddSourceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** text, faq, file or url. */
    readonly kind: string
    /** The title; a link or file without one is titled from its address or name. */
    readonly title: string
    /** The text of a note or Q&A list. */
    readonly content?: string
    /** The address of a link source. */
    readonly url?: string
    /** The storage object of an uploaded file. */
    readonly storagePath?: string
    /** The topic label. */
    readonly topic?: string
    /** The tags. */
    readonly tags?: ReadonlyArray<string>
    /** The module (agent type) the document is for; omitted means every module. */
    readonly module?: string
    /** The agent instance that alone reads the document. */
    readonly installationId?: string
    /** public or internal. */
    readonly visibility?: string
    /** Where it came from: a folder, a ZIP, the Google Picker. */
    readonly origin?: string
}
