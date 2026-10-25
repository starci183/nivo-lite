"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { queryBookingBoard } from "@/modules/api/graphql/queries/query-booking-board"
import type { QueryBookingBoardRequest } from "@/modules/api/graphql/queries/types/booking-board"

/** The SWR key of the `bookingBoard` query. */
export const QUERY_BOOKING_BOARD_SWR_KEY = "QUERY_BOOKING_BOARD_SWR"

/** The booking workbench board of one range of dates (an empty request answers the current week of the workspace timezone). */
export const useQueryBookingBoardSwr = (request?: QueryBookingBoardRequest | null, config?: SWRConfiguration) =>
    useSWR(
        useWorkspaceParamsKey(QUERY_BOOKING_BOARD_SWR_KEY, [request ?? null]),
        async (key: WorkspaceReadKey<QueryBookingBoardRequest | null>) => {
            const result = await queryBookingBoard({ request: key[2] ?? {} })
            if (!result.data) throw new Error("bookingBoard answered no data")
            return result.data.bookingBoard
        },
        config,
    )
