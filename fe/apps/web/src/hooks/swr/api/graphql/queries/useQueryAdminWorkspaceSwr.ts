"use client"

import useSWR from "swr"
import { queryAdminWorkspace } from "@/modules/api/graphql/queries/query-admin-workspace"
import type { QueryAdminWorkspaceRequest } from "@/modules/api/graphql/queries/query-admin-workspace"

/** The SWR key of the adminWorkspace query; mutations that change it call `mutate` with a matcher on this key. */
export const QUERY_ADMIN_WORKSPACE_SWR_KEY = "QUERY_ADMIN_WORKSPACE_SWR"

/**
 * Reads the read-only overview of one workspace (the back end `adminWorkspace` query).
 * The back end audits every read, so the result never revalidates on focus or reconnect.
 */
export const useQueryAdminWorkspaceSwr = (request: QueryAdminWorkspaceRequest) =>
    useSWR(
        [QUERY_ADMIN_WORKSPACE_SWR_KEY, ...Object.values(request)],
        async () => {
            const result = await queryAdminWorkspace({ request })
            if (!result.data) throw new Error("adminWorkspace answered no data")
            return result.data.adminWorkspace
        },
        { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false },
    )
