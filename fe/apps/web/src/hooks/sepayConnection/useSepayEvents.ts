"use client"

import { useMemo } from "react"
import { useQuerySepayConnectionEventsSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { SEPAY_POLL_MS, sepayEventOf } from "./sepayConnection.shared"

/** The newest webhook deliveries of one SePay connection, newest first, polled while the page is open. */
export const useSepayEvents = (connectionId: string) => {
    const query = useQuerySepayConnectionEventsSwr(connectionId, { refreshInterval: SEPAY_POLL_MS })
    const data = useMemo(() => query.data?.map(sepayEventOf), [query.data])
    return {
        slot: slotOfSwr({ data, error: query.error, isLoading: query.isLoading }),
        retry: () => {
            void query.mutate()
        },
    }
}
