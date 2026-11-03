"use client"

import { useMemo } from "react"
import { useQuerySepayConnectionSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { isInvalidFailure, isNotFoundFailure } from "@/modules/failure"
import { SEPAY_POLL_MS, sepayConnectionOf } from "./sepayConnection.shared"

import type { DataSlot, SepayConnectionView } from "@/modules/types"
import type { SWRResponse, SWRConfiguration } from "swr"

type UseSepayConnectionResult = {
    read: SWRResponse<
        {
            id: string
            name: string
            status: string
            environment: string
            lastError: string | null
            bankCode: string
            bank: string
            accountMasked: string
            hasFullAccount: boolean
            holder: string
            webhookUrl: string
            apiKeyMasked: string
            pingSeenAt: string | null
            transactionSeenAt: string | null
            agentIds: Array<string>
            health: {
                lastWebhookAt: string | null
                validCount: number
                totalCount: number
                duplicateCount: number
            }
        },
        unknown,
        SWRConfiguration | undefined
    >
    slot: DataSlot<SepayConnectionView>
    isMissing: boolean
    retry: () => void
}

/** The page read model of one SePay connection, looked at again while the page is open so the checklist and the tiles are live. */
export const useSepayConnection = (connectionId: string): UseSepayConnectionResult => {
    const query = useQuerySepayConnectionSwr(connectionId, { refreshInterval: SEPAY_POLL_MS })
    const data = useMemo(() => (query.data === undefined ? undefined : sepayConnectionOf(query.data)), [query.data])
    return {
        read: query,
        slot: slotOfSwr({ data, error: query.error, isLoading: query.isLoading }),
        isMissing: query.error !== undefined && (isNotFoundFailure(query.error) || isInvalidFailure(query.error)),
        retry: (): void => {
            void query.mutate()
        },
    }
}
