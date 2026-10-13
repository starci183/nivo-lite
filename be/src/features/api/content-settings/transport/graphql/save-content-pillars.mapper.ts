import { ContentPillarDraftSelectionMapper } from "@modules/domain/content-pillars"
import type { SavedContentRows } from "@modules/domain/content-settings"
import type { SaveContentPillarsRequest } from "../../application/save-content-pillars.contracts"
import type { SaveContentPillarsInput } from "./dto/save-content-pillars.input"
import type { SavedContentRowsType } from "./dto/saved-content-rows.type"

/** Maps the GraphQL selection and configuration arguments. */
export const toSaveContentPillarsRequest = (
    workspaceId: string,
    input: SaveContentPillarsInput,
): SaveContentPillarsRequest => ({
    workspaceId,
    rows: new ContentPillarDraftSelectionMapper(input.rows).rows,
})

/** Maps the configuration result to the public GraphQL shape. */
export const toSaveContentPillarsType = (result: SavedContentRows): SavedContentRowsType => ({ count: result.count })
