"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateExplainShiftsSchedule,
    type MutateExplainShiftsScheduleRequest,
} from "@/modules/api/graphql/mutations/mutation-explain-shifts-schedule"
import type { SWRMutationResponse } from "swr/mutation"
import type { ExplainShiftsScheduleMutation } from "@/modules/api"

/** What the explainShiftsSchedule mutation is triggered with. */
interface ExplainShiftsScheduleArg {
    readonly arg: MutateExplainShiftsScheduleRequest
}

/** The SWR key of the `explainShiftsSchedule` mutation. */
export const MUTATE_EXPLAIN_SHIFTS_SCHEDULE_SWR_KEY = "MUTATE_EXPLAIN_SHIFTS_SCHEDULE_SWR"

/** SWR mutation for {@link mutateExplainShiftsSchedule}: `trigger(request)` answers `explainShiftsSchedule` and rejects with the back end failure. */
export const useMutateExplainShiftsScheduleSwr = (): SWRMutationResponse<
    ExplainShiftsScheduleMutation["explainShiftsSchedule"],
    Error,
    typeof MUTATE_EXPLAIN_SHIFTS_SCHEDULE_SWR_KEY,
    ExplainShiftsScheduleArg["arg"]
> =>
    useSWRMutation(MUTATE_EXPLAIN_SHIFTS_SCHEDULE_SWR_KEY, async (_key: string, { arg }: ExplainShiftsScheduleArg) => {
        const result = await mutateExplainShiftsSchedule({ request: arg })
        if (!result.data) throw new Error("explainShiftsSchedule answered no data")
        return result.data.explainShiftsSchedule
    })
