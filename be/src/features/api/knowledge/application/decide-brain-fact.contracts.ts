/** What the DecideBrainFact operation takes. */
export interface DecideBrainFactRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The id. */
    readonly id: string
    /** `apply`, `reject`, `choose`, `split` or `retire`. */
    readonly action: "apply" | "reject" | "choose" | "split" | "retire"
    /** The reason given with the decision. */
    readonly note?: string | undefined
    /** The situation a split value is for. */
    readonly situation?: string | undefined
}
