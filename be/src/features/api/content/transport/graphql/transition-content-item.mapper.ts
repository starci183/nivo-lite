import type {
    TransitionContentItemRequest,
    TransitionContentItemResult,
} from "../../application/transition-content-item.contracts"
import type { TransitionContentItemInput } from "./dto/transition-content-item.input"
import type { ContentItemIdType } from "./dto/content-item-id.type"

/** Maps validated arguments to the application request. */
export const toTransitionContentItemRequest = (
    workspaceId: string,
    input: TransitionContentItemInput,
): TransitionContentItemRequest => ({ workspaceId, id: input.id, kind: input.kind })

/** Maps the result to the public GraphQL type. */
export const toTransitionContentItemType = (result: TransitionContentItemResult): ContentItemIdType => ({ ...result })
