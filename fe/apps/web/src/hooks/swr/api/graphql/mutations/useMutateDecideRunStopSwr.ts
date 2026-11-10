"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { mutateDecideRunStop, type MutateDecideRunStopRequest } from "@/modules/api/graphql/mutations/mutation-decide-run-stop"
import type { DecideRunStopMutation } from "@/modules/api"

/** What the DecideRunStop mutation is triggered with. */
interface DecideRunStopArg {
    readonly arg: MutateDecideRunStopRequest
}

/** The SWR identity of {@link useMutateDecideRunStopSwr}. */
export const MUTATE_DECIDE_RUN_STOP_SWR_KEY = "MUTATE_DECIDE_RUN_STOP_SWR"

/**
 * SWR mutation for {@link mutateDecideRunStop}: answers the stop card of a run (answer, retry, take over, skip) as the caller's seat and
 * answers the outcome; the caller reads its thread again, so the card rewritten in place is drawn anew.
 */
export const useMutateDecideRunStopSwr = (
    workspaceId: string,
): SWRMutationResponse<
    DecideRunStopMutation["decideRunStop"],
    Error,
    [string, string],
    DecideRunStopArg["arg"]
> =>
    useSWRMutation(
        [MUTATE_DECIDE_RUN_STOP_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: DecideRunStopArg) => {
            const result = await mutateDecideRunStop({ request: arg, headers: { "X-Workspace-Id": scope } })
            if (!result.data) throw new Error("decideRunStop answered no data")
            return result.data.decideRunStop
        },
    )
