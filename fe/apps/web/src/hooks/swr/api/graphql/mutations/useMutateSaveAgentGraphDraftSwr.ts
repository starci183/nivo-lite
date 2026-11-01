"use client"

import { mutateSaveAgentGraphDraft } from "@/modules/api/graphql/mutations/mutation-save-agent-graph-draft"
import type { mutateSaveAgentGraphDraft as MutateSaveAgentGraphDraftOperation } from "@/modules/api/graphql/mutations/mutation-save-agent-graph-draft"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the saveAgentGraphDraft mutation. */
export const MUTATE_SAVE_AGENT_GRAPH_DRAFT_SWR_KEY = "MUTATE_SAVE_AGENT_GRAPH_DRAFT_SWR"

/** SWR mutation for {@link mutateSaveAgentGraphDraft}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveAgentGraphDraftSwr = () =>
    useSWRMutation(
        MUTATE_SAVE_AGENT_GRAPH_DRAFT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSaveAgentGraphDraft({ request: arg }), MUTATE_SAVE_AGENT_GRAPH_DRAFT_SWR_KEY)
                .saveAgentGraphDraft,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSaveAgentGraphDraftOperation>[0]["request"]
}
