import { mutateSaveContentItem } from "@/modules/api/graphql/mutations/mutation-save-content-item"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the saveContentItem mutation. */
export const MUTATE_SAVE_CONTENT_ITEM_SWR_KEY = "MUTATE_SAVE_CONTENT_ITEM_SWR"

/** SWR mutation for {@link mutateSaveContentItem}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveContentItemSwr = () =>
    useGraphQLMutationSwr(MUTATE_SAVE_CONTENT_ITEM_SWR_KEY, mutateSaveContentItem, (data) => data.saveContentItem)
