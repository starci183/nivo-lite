import { mutateSetContentAutomation } from "@/modules/api/graphql/mutations/mutation-set-content-automation"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the setContentAutomation mutation. */
export const MUTATE_SET_CONTENT_AUTOMATION_SWR_KEY = "MUTATE_SET_CONTENT_AUTOMATION_SWR"

/** SWR mutation for {@link mutateSetContentAutomation}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetContentAutomationSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_SET_CONTENT_AUTOMATION_SWR_KEY,
        mutateSetContentAutomation,
        (data) => data.setContentAutomation,
    )
