import { mutateMoveContentItem } from "@/modules/api/graphql/mutations/mutation-move-content-item"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the moveContentItem mutation. */
export const MUTATE_MOVE_CONTENT_ITEM_SWR_KEY = "MUTATE_MOVE_CONTENT_ITEM_SWR"

/** SWR mutation for {@link mutateMoveContentItem}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateMoveContentItemSwr = () =>
    useGraphQLMutationSwr(MUTATE_MOVE_CONTENT_ITEM_SWR_KEY, mutateMoveContentItem, (data) => data.moveContentItem)
