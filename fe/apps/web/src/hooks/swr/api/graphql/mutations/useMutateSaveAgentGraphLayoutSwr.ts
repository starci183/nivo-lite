"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveAgentGraphLayout, type MutateSaveAgentGraphLayoutRequest } from "@/modules/api/graphql/mutations/mutation-save-agent-graph-layout"
import type { SWRMutationResponse } from "swr/mutation"
import type { SaveAgentGraphLayoutMutation } from "@/modules/api"

/** What the SaveAgentGraphLayout mutation is triggered with. */
interface SaveAgentGraphLayoutArg {
    readonly arg: MutateSaveAgentGraphLayoutRequest
}

/** The SWR key of {@link useMutateSaveAgentGraphLayoutSwr}. */
export const MUTATE_SAVE_AGENT_GRAPH_LAYOUT_SWR_KEY = "MUTATE_SAVE_AGENT_GRAPH_LAYOUT_SWR"

/** SWR mutation for {@link mutateSaveAgentGraphLayout}: `trigger(request)` answers the layout kept and rejects with the back end failure. */
export const useMutateSaveAgentGraphLayoutSwr = (): SWRMutationResponse<SaveAgentGraphLayoutMutation["saveAgentGraphLayout"], Error, typeof MUTATE_SAVE_AGENT_GRAPH_LAYOUT_SWR_KEY, SaveAgentGraphLayoutArg["arg"]> =>
    useSWRMutation(MUTATE_SAVE_AGENT_GRAPH_LAYOUT_SWR_KEY, async (_key: string, { arg }: SaveAgentGraphLayoutArg) => {
        const result = await mutateSaveAgentGraphLayout({ request: arg })
        if (!result.data) throw new Error("saveAgentGraphLayout answered no data")
        return result.data.saveAgentGraphLayout
    })
