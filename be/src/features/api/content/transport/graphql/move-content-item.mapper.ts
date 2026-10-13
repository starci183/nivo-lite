import type { MoveContentItemRequest } from "../../application/move-content-item.contracts"
import type { MoveContentItemInput } from "./dto/move-content-item.input"
import type { ContentItem } from "@modules/domain/content-items"
import { toContentItemType } from "./content-item.mapper"
import type { ContentItemType } from "./dto/content-item.type"

/** Maps validated arguments to the application request. */
export const toMoveContentItemRequest = (workspaceId: string, input: MoveContentItemInput): MoveContentItemRequest => ({
    workspaceId,
    id: input.id,
    scheduledAt: input.scheduledAt,
})

/** Maps the result to the public GraphQL type. */
export const toMoveContentItemType = (result: ContentItem): ContentItemType => toContentItemType(result)
