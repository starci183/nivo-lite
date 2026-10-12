import type { ApplyStarterParams } from "@modules/domain/inventory"

/** What the request to load a starter set of suppliers, items and recipes takes. */
export interface ApplyStarterRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: ApplyStarterParams
}
