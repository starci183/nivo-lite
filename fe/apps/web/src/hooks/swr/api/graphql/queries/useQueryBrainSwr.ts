import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryBrain } from "@/modules/api/graphql/queries/query-brain"

/** The SWR key of the brain read; mutations that change it revalidate the keys that lead with it. */
export const QUERY_BRAIN_SWR_KEY = "QUERY_BRAIN_SWR"

const READING_STATUSES: ReadonlyArray<string> = ["queued", "running"]

/**
 * The shared Second Brain of the active workspace (the back end `brain` query). Polls while a document reading is still
 * on, so newly proposed facts and lessons appear on their own.
 */
export const useQueryBrainSwr = () => {
    const key = useWorkspaceKey(QUERY_BRAIN_SWR_KEY, [])
    return useSWR(
        key,
        async ({ signal }: { signal?: AbortSignal } = {}) => {
            const result = await queryBrain({ signal })
            if (!result.data) throw new Error("brain answered no data")
            return result.data.brain
        },
        {
            refreshInterval: (data) =>
                data?.extractions.some((one) => READING_STATUSES.includes(one.status)) ? 4_000 : 0,
        },
    )
}
