"use client"

import useSWR from "swr"
import { queryAdminHealth } from "@/modules/api/graphql/queries/query-admin-health"

/** The SWR key of the adminHealth query; mutations that change it call `mutate` with a matcher on this key. */
export const QUERY_ADMIN_HEALTH_SWR_KEY = "QUERY_ADMIN_HEALTH_SWR"

/**
 * Reads sign-ups, billing events, application errors and the latest console activity (the back end `adminHealth` query).
 * The back end audits every read, so the result never revalidates on focus or reconnect.
 */
export const useQueryAdminHealthSwr = () =>
    useSWR(
        QUERY_ADMIN_HEALTH_SWR_KEY,
        async () => {
            const result = await queryAdminHealth()
            if (!result.data) throw new Error("adminHealth answered no data")
            return result.data.adminHealth
        },
        { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false },
    )
