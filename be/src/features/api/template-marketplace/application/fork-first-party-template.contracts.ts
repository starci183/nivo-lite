/** What the ForkFirstPartyTemplate operation takes. */
export interface ForkFirstPartyTemplateRequest {
    /** The workspace the creator names, whose owner they are. */
    readonly workspaceId: string
    /** The first-party key. */
    readonly sourceKey: string
    /** The key of the derivative. */
    readonly key: string
}
