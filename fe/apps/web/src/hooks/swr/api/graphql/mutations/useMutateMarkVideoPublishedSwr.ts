import { mutateMarkVideoPublished } from "@/modules/api/graphql/mutations/mutation-mark-video-published"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the markVideoPublished mutation. */
export const MUTATE_MARK_VIDEO_PUBLISHED_SWR_KEY = "MUTATE_MARK_VIDEO_PUBLISHED_SWR"

/** SWR mutation for {@link mutateMarkVideoPublished}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateMarkVideoPublishedSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_MARK_VIDEO_PUBLISHED_SWR_KEY,
        mutateMarkVideoPublished,
        (data) => data.markVideoPublished,
    )
