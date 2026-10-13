import { useRef } from "react"
import useSWR from "swr"
import type { AgentGenerationStatusType } from "@/modules/api"
import { queryAgentGenerationStatus } from "@/modules/api/graphql/queries/query-agent-generation-status"

/** SWR identity of the state of a queued text. */
const QUERY_AGENT_GENERATION_STATUS_SWR_KEY = "QUERY_AGENT_GENERATION_STATUS_SWR"

const POLL_MS = 1500
const MAX_RETRIES = 3

/** Whether the text is final: nothing more will change in it. */
const isFinal = (generation: AgentGenerationStatusType | undefined): boolean =>
    generation?.status === "done" || generation?.status === "failed"

/** What the poll tells its caller: the final state once, or that the status could not be read after the retries. */
interface GenerationStatusListeners {
    readonly onSettled: (generation: AgentGenerationStatusType) => void
    readonly onUnreachable: () => void
}

/** Polls a queued text until it is done or failed; after `MAX_RETRIES` reads in a row fail, the caller hears it cannot be read. */
export const useQueryAgentGenerationStatusSwr = (
    generationId: string | undefined,
    listeners: GenerationStatusListeners,
) => {
    const failures = useRef(0)
    return useSWR(
        generationId === undefined ? null : [QUERY_AGENT_GENERATION_STATUS_SWR_KEY, generationId],
        async ([, id]: [string, string]) => {
            const result = await queryAgentGenerationStatus({ request: { generationId: id } })
            if (!result.data) throw new Error("agentGenerationStatus answered no data")
            return result.data.agentGenerationStatus
        },
        {
            refreshInterval: (data) => (isFinal(data) ? 0 : POLL_MS),
            errorRetryInterval: POLL_MS,
            errorRetryCount: MAX_RETRIES,
            onSuccess: (data) => {
                failures.current = 0
                if (isFinal(data)) listeners.onSettled(data)
            },
            onError: () => {
                failures.current += 1
                if (failures.current > MAX_RETRIES) {
                    failures.current = 0
                    listeners.onUnreachable()
                }
            },
        },
    )
}
