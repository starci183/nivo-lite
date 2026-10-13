import useSWRMutation from "swr/mutation"
import { mutateStopFailedStep } from "@/modules/api/graphql/mutations/mutation-stop-failed-step"
import type { MutateStopFailedStepRequest } from "@/modules/api/graphql/mutations/mutation-stop-failed-step"

/** What the stopFailedStep mutation is triggered with. */
interface StopFailedStepArg {
    readonly arg: MutateStopFailedStepRequest
}

/** The SWR key of the stopFailedStep mutation. */
export const MUTATE_STOP_FAILED_STEP_SWR_KEY = "MUTATE_STOP_FAILED_STEP_SWR"

/** SWR mutation for {@link mutateStopFailedStep}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateStopFailedStepSwr = () =>
    useSWRMutation(MUTATE_STOP_FAILED_STEP_SWR_KEY, async (_key: string, { arg }: StopFailedStepArg) => {
        const result = await mutateStopFailedStep({ request: arg })
        if (!result.data) throw new Error("stopFailedStep answered no data")
        return result.data.stopFailedStep
    })
