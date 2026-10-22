"use client"

import { mutateAssignAgentWork } from "@/modules/api/graphql/mutations/mutation-assign-agent-work"
import type { mutateAssignAgentWork as MutateAssignAgentWorkOperation } from "@/modules/api/graphql/mutations/mutation-assign-agent-work"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the assignAgentWork mutation. */
export const MUTATE_ASSIGN_AGENT_WORK_SWR_KEY = "MUTATE_ASSIGN_AGENT_WORK_SWR"

/** SWR mutation for {@link mutateAssignAgentWork}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAssignAgentWorkSwr = () =>
    useSWRMutation(
        MUTATE_ASSIGN_AGENT_WORK_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateAssignAgentWork({ request: arg }), MUTATE_ASSIGN_AGENT_WORK_SWR_KEY)
                .assignAgentWork,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateAssignAgentWorkOperation>[0]["request"]
}
