"use client"

import useSWR from "swr"
import { queryConnections } from "@/modules/api/graphql/queries/query-connections"

/** The SWR key of the connections query. */
export const QUERY_CONNECTIONS_SWR_KEY = "QUERY_CONNECTIONS_SWR"

/** The connections of the workspace with the agents bound to each. */
export const useQueryConnectionsSwr = () =>
    useSWR(QUERY_CONNECTIONS_SWR_KEY, async ({ signal }: { signal?: AbortSignal } = {}) => {
        const result = await queryConnections({ signal })
        if (!result.data) throw new Error("connections answered no data")
        return result.data.connections
    })
