import type { ContentItem } from "@modules/domain/content-items"
import { ContentRangeSelectionMapper } from "@modules/domain/content-items"
import type { ListContentItemsRequest } from "../../application/content-items.contracts"
import { toContentItemType } from "./content-item.mapper"
import type { ContentItemType } from "./dto/content-item.type"
import type { ContentItemsInput } from "./dto/content-items.input"

/** Maps optional schedule bounds to the workspace-scoped list request. */
export const toContentItemsRequest = (
    input: ContentItemsInput | undefined,
    workspaceId: string,
): ListContentItemsRequest => ({ workspaceId, range: new ContentRangeSelectionMapper(input).range })

/** Maps each item in the scheduled list to GraphQL editor fields. */
export const toContentItemsType = (result: ReadonlyArray<ContentItem>): Array<ContentItemType> =>
    result.map(toContentItemType)
