"use client"

import { connectionPageOf, pollUnlessHealthy } from "@/hooks/connectionPage"
import { useQueryZaloConnectionPageSwr } from "@/hooks/swr"
import { ZALO_PAGE_POLL_MS } from "./zaloConnection.shared"

/** The page of one Zalo OA connection, asked again while the connection needs attention; `isMissing` once the back end says no such connection exists (an id it does not know, or one that is no id). */
export const useZaloPage = (connectionId: string) =>
    connectionPageOf(
        useQueryZaloConnectionPageSwr(connectionId, { refreshInterval: pollUnlessHealthy(ZALO_PAGE_POLL_MS) }),
    )

/** What one read of the page answers. */
export type ZaloPageData = NonNullable<ReturnType<typeof useZaloPage>["slot"]["items"]>
