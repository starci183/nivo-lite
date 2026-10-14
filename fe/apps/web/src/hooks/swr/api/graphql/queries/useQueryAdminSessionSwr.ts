"use client"

import useSWR from "swr"
import { queryAdminSession } from "@/modules/api/graphql/queries/query-admin-session"

/** The SWR key of the adminSession query; mutations that change it call `mutate` with a matcher on this key. */
export const QUERY_ADMIN_SESSION_SWR_KEY = "QUERY_ADMIN_SESSION_SWR"

/**
 * Asks who the signed-in platform admin is; anyone else is refused as not found (the back end `adminSession` query).
 */
export const useQueryAdminSessionSwr = () =>
    useSWR(
        QUERY_ADMIN_SESSION_SWR_KEY,
        async () => {
            const result = await queryAdminSession()
            if (!result.data) throw new Error("adminSession answered no data")
            return result.data.adminSession
        },
        { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false },
    )
