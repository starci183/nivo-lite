import type { SaveContentItemRequest } from "../../application/save-content-item.contracts"
import type { SaveContentItemInput } from "./dto/save-content-item.input"
import type { ContentItem } from "@modules/domain/content-items"
import { ContentPatchSelectionMapper } from "@modules/domain/content-items"
import { toContentItemType } from "./content-item.mapper"
import type { ContentItemType } from "./dto/content-item.type"

/** Maps validated arguments to the application request. */
export const toSaveContentItemRequest = (workspaceId: string, input: SaveContentItemInput): SaveContentItemRequest => ({
    workspaceId,
    id: input.id,
    input: new ContentPatchSelectionMapper({
        title: input.title,
        channels: input.channels,
        scheduledAt: input.scheduledAt,
        pillarId: input.pillarId,
        brief: input.brief,
        variants: input.variants,
        hashtags: input.hashtags,
        links: input.links,
        media: input.media,
    }).patch,
})

/** Maps the result to the public GraphQL type. */
export const toSaveContentItemType = (result: ContentItem): ContentItemType => toContentItemType(result)
