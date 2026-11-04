"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryConnections } from "@/modules/api/graphql/queries/query-connections"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import type { ConnectionsQuery } from "@/modules/api"

/** The SWR key of the connections query. */
export const QUERY_CONNECTIONS_SWR_KEY = "QUERY_CONNECTIONS_SWR"

/** The connections of the workspace with the agents bound to each. */
export const useQueryConnectionsSwr = (): ReadResponse<ConnectionsQuery["connections"]> =>
    useSWR(
        useWorkspaceKey(QUERY_CONNECTIONS_SWR_KEY, []),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryConnections({ signal }), "connections").connections,
    )
