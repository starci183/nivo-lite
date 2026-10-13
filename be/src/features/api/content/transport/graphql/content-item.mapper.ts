import type { ContentItem } from "@modules/domain/content-items"
import { ContentItemViewMapper } from "@modules/domain/content-items"
import type { GetContentItemRequest } from "../../application/content-item.contracts"
import type { ContentItemInput } from "./dto/content-item.input"
import type { ContentItemType } from "./dto/content-item.type"

/** Maps the selected post id to its workspace-scoped application request. */
export const toContentItemRequest = (input: ContentItemInput, workspaceId: string): GetContentItemRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps an editor post to typed GraphQL fields, with channel maps represented as lists. */
export const toContentItemType = (result: ContentItem): ContentItemType => new ContentItemViewMapper(result)
