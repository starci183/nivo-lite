import type { SavedContentRows } from "@modules/domain/content-settings"
import type { ApplyContentPillarPresetsRequest } from "../../application/apply-content-pillar-presets.contracts"
import type { SavedContentRowsType } from "./dto/saved-content-rows.type"

/** Maps the GraphQL selection and configuration arguments. */
export const toApplyContentPillarPresetsRequest = (workspaceId: string): ApplyContentPillarPresetsRequest => ({
    workspaceId,
})

/** Maps the configuration result to the public GraphQL shape. */
export const toApplyContentPillarPresetsType = (result: SavedContentRows): SavedContentRowsType => ({
    count: result.count,
})
