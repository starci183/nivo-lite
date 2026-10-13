import { mutateAskGuide } from "@/modules/api/graphql/mutations/mutation-ask-guide"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the askGuide mutation. */
const MUTATE_ASK_GUIDE_SWR_KEY = "MUTATE_ASK_GUIDE_SWR"

/** SWR mutation for {@link mutateAskGuide}: `trigger(input)` answers the queued text and rejects with the back end failure. */
export const useMutateAskGuideSwr = () =>
    useGraphQLMutationSwr(MUTATE_ASK_GUIDE_SWR_KEY, mutateAskGuide, (data) => data.askGuide)
