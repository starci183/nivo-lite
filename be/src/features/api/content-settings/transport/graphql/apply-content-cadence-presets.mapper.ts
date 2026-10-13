import type { SavedContentRows } from "@modules/domain/content-settings"
import type { ApplyContentCadencePresetsRequest } from "../../application/apply-content-cadence-presets.contracts"
import type { SavedContentRowsType } from "./dto/saved-content-rows.type"

/** Maps the GraphQL selection and configuration arguments. */
export const toApplyContentCadencePresetsRequest = (workspaceId: string): ApplyContentCadencePresetsRequest => ({
    workspaceId,
})

/** Maps the configuration result to the public GraphQL shape. */
export const toApplyContentCadencePresetsType = (result: SavedContentRows): SavedContentRowsType => ({
    count: result.count,
})
