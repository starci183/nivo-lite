"use client"

import useSWRInfinite from "swr/infinite"
import type { SWRInfiniteKeyLoader } from "swr/infinite"
import { connectionPageKey, connectionPageView, connectionReadParameters } from "@/hooks/connectionPages"
import type { ConnectionPage, ConnectionPageKey } from "@/hooks/connectionPages"
import { noData } from "@/hooks/workspaceread"
import { queryLeadBoard } from "@/modules/api/graphql/queries/query-lead-board"
import { GraphQLHeadersKey } from "@/modules/api"
import type { LeadBoardQuery } from "@/modules/api"

/** Workspace-scoped cache identity for the leadBoard query. */
export const QUERY_LEAD_BOARD_SWR_KEY = "QUERY_LEAD_BOARD_SWR"

type LeadBoardPage = ConnectionPage<LeadBoardQuery["leadBoard"]["nodes"][number]>

/** The cache and bounded initial capacity of a lead board reader. */
interface LeadBoardOptions {
    readonly cacheKey: string
    readonly initialSize: number
}

/** Reads all loaded lead pages; a workspace switch starts a new cursor chain. */
export const useQueryLeadBoardSwr = (workspaceId: string | undefined, options?: LeadBoardOptions) => {
    const getKey: SWRInfiniteKeyLoader<LeadBoardPage, ConnectionPageKey | null> = (index, previous) =>
        connectionPageKey(options?.cacheKey ?? QUERY_LEAD_BOARD_SWR_KEY, workspaceId, index, previous)
    const query = useSWRInfinite<LeadBoardPage, Error>(
        getKey,
        async (key: ConnectionPageKey) =>
            (await queryLeadBoard(connectionReadParameters(key, GraphQLHeadersKey.XWorkspaceId))).data?.leadBoard ??
            noData("leadBoard"),
        { initialSize: options?.initialSize ?? 1, persistSize: false, keepPreviousData: false, revalidateAll: true },
    )
    return connectionPageView(query)
}
