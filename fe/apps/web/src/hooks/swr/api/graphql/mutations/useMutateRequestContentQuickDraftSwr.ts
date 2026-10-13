import { mutateRequestContentQuickDraft } from "@/modules/api/graphql/mutations/mutation-request-content-quick-draft"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the requestContentQuickDraft mutation. */
export const MUTATE_REQUEST_CONTENT_QUICK_DRAFT_SWR_KEY = "MUTATE_REQUEST_CONTENT_QUICK_DRAFT_SWR"

/** SWR mutation for {@link mutateRequestContentQuickDraft}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestContentQuickDraftSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_REQUEST_CONTENT_QUICK_DRAFT_SWR_KEY,
        mutateRequestContentQuickDraft,
        (data) => data.requestContentQuickDraft,
    )
