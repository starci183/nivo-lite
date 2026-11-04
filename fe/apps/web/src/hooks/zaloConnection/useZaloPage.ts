"use client"

import { connectionPageOf, pollConnectionPage } from "@/hooks/connectionPage"
import { useQueryZaloConnectionPageSwr } from "@/hooks/swr"
import { ZALO_PAGE_POLL_MS } from "./zaloConnection.shared"

import type { DataSlot } from "@/modules/types"
import type { SWRResponse, KeyedMutator } from "swr"

type ZaloPage = NonNullable<ReturnType<typeof useQueryZaloConnectionPageSwr>["data"]>

type UseZaloPageResult = {
    read: SWRResponse<ZaloPage, unknown>
    slot: DataSlot<ZaloPage>
    isMissing: boolean
    reload: () => undefined
    mutate: KeyedMutator<ZaloPage>
}

/** The page of one Zalo OA connection, asked again, fast while the connection needs attention and slowly while it is healthy; `isMissing` once the back end says no such connection exists (an id it does not know, or one that is no id). */
export const useZaloPage = (connectionId: string): UseZaloPageResult =>
    connectionPageOf(
        useQueryZaloConnectionPageSwr(connectionId, { refreshInterval: pollConnectionPage(ZALO_PAGE_POLL_MS) }),
    )

/** What one read of the page answers. */
export type ZaloPageData = NonNullable<ReturnType<typeof useZaloPage>["read"]["data"]>
