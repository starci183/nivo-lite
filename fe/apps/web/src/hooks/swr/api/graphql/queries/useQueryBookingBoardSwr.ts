"use client"

import { useState } from "react"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { queryBookingBoard } from "@/modules/api/graphql/queries/query-booking-board"
import type { QueryBookingBoardRequest } from "@/modules/api/graphql/queries/types/booking-board"

/** The SWR key of the `bookingBoard` query. */
export const QUERY_BOOKING_BOARD_SWR_KEY = "QUERY_BOOKING_BOARD_SWR"

/** Reads one booking range, retaining earlier ranges only inside the same resolved workspace; inactive scopes pause. */
export const useQueryBookingBoardSwr = (
    request?: QueryBookingBoardRequest | null,
    config?: SWRConfiguration,
    isActive = true,
) => {
    const key = useWorkspaceParamsKey(QUERY_BOOKING_BOARD_SWR_KEY, isActive ? [request ?? null] : null)
    const workspaceId = key?.[1]
    const [resolvedWorkspaceId, setResolvedWorkspaceId] = useState(workspaceId)
    const read = useSWR(
        key,
        async (key: WorkspaceReadKey<QueryBookingBoardRequest | null>) => {
            const result = await queryBookingBoard({ request: key[2] ?? {} })
            if (!result.data) throw new Error("bookingBoard answered no data")
            return result.data.bookingBoard
        },
        { ...config, keepPreviousData: config?.keepPreviousData === true && workspaceId === resolvedWorkspaceId },
    )
    if (
        workspaceId !== undefined &&
        workspaceId !== resolvedWorkspaceId &&
        read.data !== undefined &&
        !read.isLoading
    ) {
        setResolvedWorkspaceId(workspaceId)
    }
    return read
}
