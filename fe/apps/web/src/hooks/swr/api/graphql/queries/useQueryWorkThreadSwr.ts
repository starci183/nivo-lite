"use client"

import { readField, workspaceArgumentKey } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useAppSelector } from "@/redux"
import { queryWorkThread } from "@/modules/api/graphql/queries/query-work-thread"
import type { QueryWorkThreadRequest } from "@/modules/api/graphql/queries/query-work-thread"

/** The SWR key of {@link useQueryWorkThreadSwr}. */
export const QUERY_WORK_THREAD_SWR_KEY = "QUERY_WORK_THREAD_SWR"

/** The back end `workThread` query. Pass `null` to wait for the arguments. */
export const useQueryWorkThreadSwr = (request: QueryWorkThreadRequest | null, config?: SWRConfiguration) => {
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    return useSWR(
        workspaceArgumentKey(QUERY_WORK_THREAD_SWR_KEY, workspaceId, request ?? undefined),
        ([, , input]: WorkspaceReadKey<QueryWorkThreadRequest>) =>
            readField(queryWorkThread, input, "workThread", QUERY_WORK_THREAD_SWR_KEY),
        config,
    )
}
