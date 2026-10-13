import type { CreateContentItemRequest } from "../../application/create-content-item.contracts"
import type { CreateContentItemInput } from "./dto/create-content-item.input"
import type { ContentItem } from "@modules/domain/content-items"
import { toContentItemType } from "./content-item.mapper"
import type { ContentItemType } from "./dto/content-item.type"

/** Maps validated arguments to the application request. */
export const toCreateContentItemRequest = (
    workspaceId: string,
    input: CreateContentItemInput,
): CreateContentItemRequest => ({
    workspaceId,
    input: { title: input.title, channels: input.channels, scheduledAt: input.scheduledAt, pillarId: input.pillarId },
})

/** Maps the result to the public GraphQL type. */
export const toCreateContentItemType = (result: ContentItem): ContentItemType => toContentItemType(result)
