import type { SaveRecipeParams } from "@modules/domain/inventory"

/** What create or update one recipe takes. */
export interface SaveInventoryRecipeRequest extends SaveRecipeParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
