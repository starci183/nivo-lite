"use client"

import { mutateRequestContentMonthPlan } from "@/modules/api/graphql/mutations/mutation-request-content-month-plan"
import type { mutateRequestContentMonthPlan as MutateRequestContentMonthPlanOperation } from "@/modules/api/graphql/mutations/mutation-request-content-month-plan"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the requestContentMonthPlan mutation. */
export const MUTATE_REQUEST_CONTENT_MONTH_PLAN_SWR_KEY = "MUTATE_REQUEST_CONTENT_MONTH_PLAN_SWR"

/** SWR mutation for {@link mutateRequestContentMonthPlan}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestContentMonthPlanSwr = () =>
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
