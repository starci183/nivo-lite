"use client"

import { readField, workspaceArgumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useAppSelector } from "@/redux"
import { queryWorkThreads } from "@/modules/api/graphql/queries/query-work-threads"

/** The SWR key of {@link useQueryWorkThreadsSwr}. */
export const QUERY_WORK_THREADS_SWR_KEY = "QUERY_WORK_THREADS_SWR"

/** The back end `workThreads` query: the newest threads of the active workspace. */
export const useQueryWorkThreadsSwr = (config?: SWRConfiguration) => {
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    return useSWR(
        workspaceArgumentKey(QUERY_WORK_THREADS_SWR_KEY, workspaceId, "all"),
        () => readField(queryWorkThreads, {}, "workThreads", QUERY_WORK_THREADS_SWR_KEY),
        config,
    )
}
