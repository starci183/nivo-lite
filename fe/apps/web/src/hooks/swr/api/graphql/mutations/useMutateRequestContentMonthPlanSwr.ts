"use client"

import {
    mutateRequestContentMonthPlan,
    type mutateRequestContentMonthPlan as MutateRequestContentMonthPlanOperation,
} from "@/modules/api/graphql/mutations/mutation-request-content-month-plan"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { RequestContentMonthPlanMutation } from "@/modules/api"

/** The SWR key of the requestContentMonthPlan mutation. */
export const MUTATE_REQUEST_CONTENT_MONTH_PLAN_SWR_KEY = "MUTATE_REQUEST_CONTENT_MONTH_PLAN_SWR"

/** SWR mutation for {@link mutateRequestContentMonthPlan}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestContentMonthPlanSwr = (): SWRMutationResponse<
    RequestContentMonthPlanMutation["requestContentMonthPlan"],
    Error,
    typeof MUTATE_REQUEST_CONTENT_MONTH_PLAN_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_REQUEST_CONTENT_MONTH_PLAN_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateRequestContentMonthPlan({ request: arg }),
                MUTATE_REQUEST_CONTENT_MONTH_PLAN_SWR_KEY,
            ).requestContentMonthPlan,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRequestContentMonthPlanOperation>[0]["request"]
}
