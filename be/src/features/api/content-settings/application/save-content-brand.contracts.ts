import type { ContentBrandInput } from "@modules/domain/content-settings"

/** Arguments of saveContentBrand. */
export interface SaveContentBrandRequest {
    /** The selected workspace; the service proves membership. */
    readonly workspaceId: string
    /** Configuration to save. */
    readonly brand: ContentBrandInput
}
