import { mutateTransitionContentItem } from "@/modules/api/graphql/mutations/mutation-transition-content-item"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the transitionContentItem mutation. */
export const MUTATE_TRANSITION_CONTENT_ITEM_SWR_KEY = "MUTATE_TRANSITION_CONTENT_ITEM_SWR"

/** SWR mutation for {@link mutateTransitionContentItem}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateTransitionContentItemSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_TRANSITION_CONTENT_ITEM_SWR_KEY,
        mutateTransitionContentItem,
        (data) => data.transitionContentItem,
    )
