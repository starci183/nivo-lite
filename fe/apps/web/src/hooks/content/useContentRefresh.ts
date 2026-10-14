"use client"

import { useCallback } from "react"
import { useSWRConfig } from "swr"

/** Revalidates content and dashboard caches after a successful change. */
export const useContentRefresh = () => {
    const { mutate } = useSWRConfig()
    const refresh = useCallback(async () => {
        await mutate((key) => {
            const head = Array.isArray(key) ? key[0] : key
            return (
                typeof head === "string" && (head.startsWith("QUERY_CONTENT_") || head === "QUERY_AGENT_DASHBOARD_SWR")
            )
        })
    }, [mutate])
    return { refresh }
}
