"use client"

import useSWRMutation from "swr/mutation"
import { mutateRunAutomationNow } from "@/modules/api/graphql/mutations/mutation-run-automation-now"
import type { MutateRunAutomationNowRequest } from "@/modules/api/graphql/mutations/mutation-run-automation-now"

/** What the RunAutomationNow mutation is triggered with. */
interface RunAutomationNowArg {
    readonly arg: MutateRunAutomationNowRequest
}

/** The SWR key of the run automation now mutation. */
export const MUTATE_RUN_AUTOMATION_NOW_SWR_KEY = "MUTATE_RUN_AUTOMATION_NOW_SWR"

/** SWR mutation for {@link mutateRunAutomationNow}: `trigger({ templateKey })` answers true once the run is queued. */
export const useMutateRunAutomationNowSwr = () =>
    useSWRMutation(MUTATE_RUN_AUTOMATION_NOW_SWR_KEY, async (_key: string, { arg }: RunAutomationNowArg) => {
        const result = await mutateRunAutomationNow({ request: arg })
        if (!result.data) throw new Error("runAutomationNow answered no data")
        return result.data.runAutomationNow
    })
