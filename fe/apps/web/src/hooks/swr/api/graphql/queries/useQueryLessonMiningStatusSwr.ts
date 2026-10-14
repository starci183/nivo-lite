"use client"

import useSWR from "swr"
import type { LessonMiningStatusType } from "@/modules/api"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryLessonMiningStatus } from "@/modules/api/graphql/queries/query-lesson-mining-status"

/** The SWR key of the lesson mining status poll. */
export const QUERY_LESSON_MINING_STATUS_SWR_KEY = "QUERY_LESSON_MINING_STATUS_SWR"

/**
 * Where the study of an agent's corrections stands (the back end `lessonMiningStatus` query). Polls until the command is
 * done or failed, then stops.
 */
export const useQueryLessonMiningStatusSwr = (
    id: string | undefined,
    onStatus?: (status: LessonMiningStatusType) => void,
) => {
    const key = useWorkspaceKey(QUERY_LESSON_MINING_STATUS_SWR_KEY, [id ?? ""], id !== undefined)
    return useSWR(
        key,
        async ([, , commandId]: readonly [string, string, string]) => {
            const result = await queryLessonMiningStatus({ request: { id: commandId } })
            if (!result.data) throw new Error("lessonMiningStatus answered no data")
            return result.data.lessonMiningStatus
        },
        {
            onSuccess: onStatus,
            refreshInterval: (data) =>
                data === undefined || data.status === "done" || data.status === "failed" ? 0 : 2_000,
        },
    )
}
