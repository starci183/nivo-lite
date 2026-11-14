"use client"

import { useMemo } from "react"
import { useQuerySepayConnectionEventsSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { SEPAY_POLL_MS, sepayEventOf } from "./sepayConnection.shared"

import type { DataSlot, SepayEventView } from "@/modules/types"

type UseSepayEventsResult = {
    slot: DataSlot<SepayEventView[]>
    retry: () => void
}

/** The newest webhook deliveries of one SePay connection, newest first, polled while the page is open. */
export const useSepayEvents = (connectionId: string): UseSepayEventsResult => {
    const query = useQuerySepayConnectionEventsSwr(connectionId, { refreshInterval: SEPAY_POLL_MS })
    const data = useMemo(() => query.data?.map((entry) => sepayEventOf(entry)), [query.data])
    return {
        slot: slotOfSwr({ data, error: query.error, isLoading: query.isLoading }),
        retry: (): void => {
            void query.mutate()
        },
    }
}
