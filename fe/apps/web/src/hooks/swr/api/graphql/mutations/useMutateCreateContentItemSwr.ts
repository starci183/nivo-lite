import { mutateCreateContentItem } from "@/modules/api/graphql/mutations/mutation-create-content-item"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the createContentItem mutation. */
export const MUTATE_CREATE_CONTENT_ITEM_SWR_KEY = "MUTATE_CREATE_CONTENT_ITEM_SWR"

/** SWR mutation for {@link mutateCreateContentItem}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCreateContentItemSwr = () =>
    useGraphQLMutationSwr(MUTATE_CREATE_CONTENT_ITEM_SWR_KEY, mutateCreateContentItem, (data) => data.createContentItem)
