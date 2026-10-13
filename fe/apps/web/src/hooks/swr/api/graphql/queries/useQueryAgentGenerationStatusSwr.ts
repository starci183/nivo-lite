import useSWR from "swr"
import type { AgentGenerationStatusType } from "@/modules/api"
import { queryAgentGenerationStatus } from "@/modules/api/graphql/queries/query-agent-generation-status"

/** SWR identity of the state of a queued text. */
const QUERY_AGENT_GENERATION_STATUS_SWR_KEY = "QUERY_AGENT_GENERATION_STATUS_SWR"

const POLL_MS = 1500

/** Whether the text is final: nothing more will change in it. */
const isFinal = (generation: AgentGenerationStatusType | undefined): boolean =>
    generation?.status === "done" || generation?.status === "failed"

/** Polls a queued text until it is done or failed; `onSettled` hears the final state once. */
export const useQueryAgentGenerationStatusSwr = (
    generationId: string | undefined,
    onSettled: (generation: AgentGenerationStatusType) => void,
) =>
    useSWR(
        generationId === undefined ? null : [QUERY_AGENT_GENERATION_STATUS_SWR_KEY, generationId],
        async ([, id]: [string, string]) => {
            const result = await queryAgentGenerationStatus({ request: { generationId: id } })
            if (!result.data) throw new Error("agentGenerationStatus answered no data")
            return result.data.agentGenerationStatus
        },
        {
            refreshInterval: (data) => (isFinal(data) ? 0 : POLL_MS),
            onSuccess: (data) => {
                if (isFinal(data)) onSettled(data)
            },
        },
    )
