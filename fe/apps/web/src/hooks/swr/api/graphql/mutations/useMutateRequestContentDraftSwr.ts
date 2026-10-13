import { mutateRequestContentDraft } from "@/modules/api/graphql/mutations/mutation-request-content-draft"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the requestContentDraft mutation. */
export const MUTATE_REQUEST_CONTENT_DRAFT_SWR_KEY = "MUTATE_REQUEST_CONTENT_DRAFT_SWR"

/** SWR mutation for {@link mutateRequestContentDraft}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestContentDraftSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_REQUEST_CONTENT_DRAFT_SWR_KEY,
        mutateRequestContentDraft,
        (data) => data.requestContentDraft,
    )
