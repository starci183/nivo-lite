import type { DeleteRecipeParams } from "@modules/domain/inventory"

/** What the request to delete one recipe takes. */
export interface DeleteRecipeRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The operation input as the transport mapped it. */
    readonly input: DeleteRecipeParams
}
