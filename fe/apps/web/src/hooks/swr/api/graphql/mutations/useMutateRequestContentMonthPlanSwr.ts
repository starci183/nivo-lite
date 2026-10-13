import { mutateRequestContentMonthPlan } from "@/modules/api/graphql/mutations/mutation-request-content-month-plan"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the requestContentMonthPlan mutation. */
export const MUTATE_REQUEST_CONTENT_MONTH_PLAN_SWR_KEY = "MUTATE_REQUEST_CONTENT_MONTH_PLAN_SWR"

/** SWR mutation for {@link mutateRequestContentMonthPlan}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestContentMonthPlanSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_REQUEST_CONTENT_MONTH_PLAN_SWR_KEY,
        mutateRequestContentMonthPlan,
        (data) => data.requestContentMonthPlan,
    )
