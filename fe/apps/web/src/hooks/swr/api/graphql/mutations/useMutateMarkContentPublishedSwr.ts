import { mutateMarkContentPublished } from "@/modules/api/graphql/mutations/mutation-mark-content-published"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the markContentPublished mutation. */
export const MUTATE_MARK_CONTENT_PUBLISHED_SWR_KEY = "MUTATE_MARK_CONTENT_PUBLISHED_SWR"

/** SWR mutation for {@link mutateMarkContentPublished}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateMarkContentPublishedSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_MARK_CONTENT_PUBLISHED_SWR_KEY,
        mutateMarkContentPublished,
        (data) => data.markContentPublished,
    )
