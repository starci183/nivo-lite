import type { GetRecentTitlesRequest } from "../../application/get-recent-titles.contracts"
import type { GetRecentTitlesInput } from "./dto/get-recent-titles.input"

/** Selects the current workspace and the title to exclude. */
export const toRecentTitlesRequest = (input: GetRecentTitlesInput, workspaceId: string): GetRecentTitlesRequest => ({
    workspaceId,
    id: input.id,
})

/** Copies the immutable application result into the GraphQL array. */
export const toRecentTitlesType = (result: ReadonlyArray<string>): Array<string> => [...result]
