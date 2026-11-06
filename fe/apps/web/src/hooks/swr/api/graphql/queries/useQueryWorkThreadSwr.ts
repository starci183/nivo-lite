"use client"

import { readField, workspaceArgumentKey, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useOpenWorkspaceId } from "@/hooks/workspaceKey"
import { queryWorkThread, type QueryWorkThreadRequest } from "@/modules/api/graphql/queries/query-work-thread"
import type { WorkThreadQuery } from "@/modules/api"

/** The SWR key of {@link useQueryWorkThreadSwr}. */
export const QUERY_WORK_THREAD_SWR_KEY = "QUERY_WORK_THREAD_SWR"

/** The back end `workThread` query. Pass `null` to wait for the arguments. */
export const useQueryWorkThreadSwr = (
    request: QueryWorkThreadRequest | null,
    config?: SWRConfiguration,
): ReadResponse<WorkThreadQuery["workThread"]> => {
    const workspaceId = useOpenWorkspaceId()
    return useSWR(
        workspaceArgumentKey(QUERY_WORK_THREAD_SWR_KEY, workspaceId, request ?? undefined),
        ([, , input]: WorkspaceReadKey<QueryWorkThreadRequest>) =>
            readField(queryWorkThread, input, "workThread", QUERY_WORK_THREAD_SWR_KEY),
        config,
    )
}
