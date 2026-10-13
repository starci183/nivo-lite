import type { SavedContentRows } from "@modules/domain/content-settings"
import type { SaveContentCadenceRequest } from "../../application/save-content-cadence.contracts"
import type { SaveContentCadenceInput } from "./dto/save-content-cadence.input"
import type { SavedContentRowsType } from "./dto/saved-content-rows.type"

/** Maps the GraphQL selection and configuration arguments. */
export const toSaveContentCadenceRequest = (
    workspaceId: string,
    input: SaveContentCadenceInput,
): SaveContentCadenceRequest => ({
    workspaceId,
    rows: input.rows.map((row) => ({
        channel: row.channel,
        postsPerWeek: row.postsPerWeek,
        days: [...row.days],
        time: row.time,
    })),
})

/** Maps the configuration result to the public GraphQL shape. */
export const toSaveContentCadenceType = (result: SavedContentRows): SavedContentRowsType => ({ count: result.count })
