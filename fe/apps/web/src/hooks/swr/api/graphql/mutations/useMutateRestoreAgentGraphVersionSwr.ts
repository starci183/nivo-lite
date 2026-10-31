"use client"

import { mutateRestoreAgentGraphVersion } from "@/modules/api/graphql/mutations/mutation-restore-agent-graph-version"
import type { mutateRestoreAgentGraphVersion as MutateRestoreAgentGraphVersionOperation } from "@/modules/api/graphql/mutations/mutation-restore-agent-graph-version"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the restoreAgentGraphVersion mutation. */
export const MUTATE_RESTORE_AGENT_GRAPH_VERSION_SWR_KEY = "MUTATE_RESTORE_AGENT_GRAPH_VERSION_SWR"

/** SWR mutation for {@link mutateRestoreAgentGraphVersion}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRestoreAgentGraphVersionSwr = () =>
    useSWRMutation(
        MUTATE_RESTORE_AGENT_GRAPH_VERSION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateRestoreAgentGraphVersion({ request: arg }),
                MUTATE_RESTORE_AGENT_GRAPH_VERSION_SWR_KEY,
            ).restoreAgentGraphVersion,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRestoreAgentGraphVersionOperation>[0]["request"]
}
