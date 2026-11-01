/** What the EnqueueKnowledgeSource operation takes. */
export interface EnqueueKnowledgeSourceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** `text`, `faq`, `file` or `url`. */
    readonly kind: string
    /** The title; a link or file without one is titled from its address or name. */
    readonly title: string
    /** The text of a note or Q&A list. */
    readonly content?: string | undefined
    /** The address of a link document. */
    readonly url?: string | undefined
    /** The storage object of an uploaded file: `<workspaceId>/<uuid>/<filename>`. */
    readonly storagePath?: string | undefined
    /** The topic label. */
    readonly topic?: string | undefined
    /** The tags. */
    readonly tags?: Array<string> | undefined
    /** The module (agent type) it is for; omitted = every module. */
    readonly module?: string | undefined
    /** The agent instance that alone reads it; omitted = every instance. */
    readonly installationId?: string | undefined
    /** `public` or `internal`, as the owner chose; there is no default. */
    readonly visibility: string
    /** Where it came from: a folder, a ZIP or the Google Picker. */
    readonly origin?: string | undefined
}
