"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { mutateRunFlow, type MutateRunFlowRequest } from "@/modules/api/graphql/mutations/mutation-run-flow"
import type { RunFlowMutation } from "@/modules/api"

/** What the RunFlow mutation is triggered with. */
interface RunFlowArg {
    readonly arg: MutateRunFlowRequest
}

/** The SWR identity of {@link useMutateRunFlowSwr}. */
export const MUTATE_RUN_FLOW_SWR_KEY = "MUTATE_RUN_FLOW_SWR"

/**
 * SWR mutation for {@link mutateRunFlow}: one command of the operating flow as the caller's seat (kind `decide` answers a work item, as
 * the team chat does); the caller reads what it shows again.
 */
export const useMutateRunFlowSwr = (
    workspaceId: string,
): SWRMutationResponse<RunFlowMutation["runFlow"], Error, [string, string], RunFlowArg["arg"]> =>
    useSWRMutation(
        [MUTATE_RUN_FLOW_SWR_KEY, workspaceId],
        async ([, scope]: [string, string], { arg }: RunFlowArg) => {
            const result = await mutateRunFlow({ request: arg, headers: { "X-Workspace-Id": scope } })
            if (!result.data) throw new Error("runFlow answered no data")
            return result.data.runFlow
        },
    )
