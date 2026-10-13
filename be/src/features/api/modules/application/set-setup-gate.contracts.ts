/** What confirming a gate of the setup takes. */
export interface SetSetupGateRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The open draft. */
    readonly setupSessionId: string
    /** The gate. */
    readonly gateKey: string
    /** What to do with it. */
    readonly action: "confirm" | "reopen" | "edit"
    /** The own wording of the owner, for an edit. */
    readonly evidence: string
}
