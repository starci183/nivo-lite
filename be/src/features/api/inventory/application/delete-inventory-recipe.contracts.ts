import type { DeleteRecipeParams } from "@modules/domain/inventory"

/** What delete one recipe takes. */
export interface DeleteInventoryRecipeRequest extends DeleteRecipeParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
