"use client"

import useSWR from "swr"
import { queryAdminWorkspaces } from "@/modules/api/graphql/queries/query-admin-workspaces"
import type { QueryAdminWorkspacesRequest } from "@/modules/api/graphql/queries/query-admin-workspaces"

/** The SWR key of the adminWorkspaces query; mutations that change it call `mutate` with a matcher on this key. */
export const QUERY_ADMIN_WORKSPACES_SWR_KEY = "QUERY_ADMIN_WORKSPACES_SWR"

/**
 * Lists every customer workspace the filter and the search keep, with the size of each filter (the back end `adminWorkspaces` query).
 * The back end audits every read, so the result never revalidates on focus or reconnect.
 */
export const useQueryAdminWorkspacesSwr = (request: QueryAdminWorkspacesRequest) =>
    useSWR(
        [QUERY_ADMIN_WORKSPACES_SWR_KEY, ...Object.values(request)],
        async () => {
            const result = await queryAdminWorkspaces({ request })
            if (!result.data) throw new Error("adminWorkspaces answered no data")
            return result.data.adminWorkspaces
        },
        { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false },
    )
