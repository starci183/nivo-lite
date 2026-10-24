"use client"

import useSWRInfinite from "swr/infinite"
import type { SWRInfiniteKeyLoader } from "swr/infinite"
import { connectionPageKey, connectionPageView, connectionReadParameters } from "@/hooks/connectionPages"
import type { ConnectionPage, ConnectionPageKey } from "@/hooks/connectionPages"
import { noData } from "@/hooks/workspaceread"
import { useAppSelector } from "@/redux"
import { queryWorkThreads } from "@/modules/api/graphql/queries/query-work-threads"
import { GraphQLHeadersKey } from "@/modules/api"
import type { WorkThreadsQuery } from "@/modules/api"

/** The SWR key of {@link useQueryWorkThreadsSwr}. */
export const QUERY_WORK_THREADS_SWR_KEY = "QUERY_WORK_THREADS_SWR"

type WorkThreadsPage = ConnectionPage<WorkThreadsQuery["workThreads"]["nodes"][number]>

/** The cadence of the work thread rail. */
interface WorkThreadsReadOptions {
    readonly refreshInterval: number
}

/** The back end `workThreads` query: the newest threads of the active workspace. */
export const useQueryWorkThreadsSwr = (config?: WorkThreadsReadOptions) => {
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    const getKey: SWRInfiniteKeyLoader<WorkThreadsPage, ConnectionPageKey | null> = (index, previous) =>
        connectionPageKey(QUERY_WORK_THREADS_SWR_KEY, workspaceId, index, previous)
    const query = useSWRInfinite<WorkThreadsPage, Error>(
        getKey,
        async (key: ConnectionPageKey) =>
            (await queryWorkThreads(connectionReadParameters(key, GraphQLHeadersKey.XWorkspaceId))).data?.workThreads ??
            noData("workThreads"),
        { ...config, persistSize: false, keepPreviousData: false, revalidateAll: true },
    )
    return connectionPageView(query)
}
