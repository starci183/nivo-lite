import type { ZaloReturn } from "@modules/domain/channels"

/** What complete Zalo authorization takes. */
export interface CompleteZaloAuthorizationRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** What Zalo sent the browser back with. */
    readonly zaloReturn: ZaloReturn
}
