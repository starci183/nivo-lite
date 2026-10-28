"use client"

import { useMemo } from "react"
import { useQuerySepayConnectionSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { SEPAY_POLL_MS, sepayConnectionOf } from "./sepayConnection.shared"

/** The page read model of one SePay connection, looked at again while the page is open so the checklist and the tiles are live. */
export const useSepayConnection = (connectionId: string) => {
    const query = useQuerySepayConnectionSwr(connectionId, { refreshInterval: SEPAY_POLL_MS })
    const data = useMemo(() => (query.data === undefined ? undefined : sepayConnectionOf(query.data)), [query.data])
    return {
        slot: slotOfSwr({ data, error: query.error, isLoading: query.isLoading }),
        retry: () => {
            void query.mutate()
        },
    }
}
