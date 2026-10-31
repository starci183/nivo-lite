"use client"

import { slotOfSwr } from "@/hooks/slot"
import { isInvalidFailure, isNotFoundFailure } from "@/modules/failure"
import { useQueryZaloConnectionPageSwr } from "@/hooks/swr"
import { ZALO_PAGE_POLL_MS } from "./zaloConnection.shared"

/** The page of one Zalo OA connection, asked again while the connection needs attention; `isMissing` once the back end says no such connection exists (an id it does not know, or one that is no id). */
export const useZaloPage = (connectionId: string) => {
    const read = useQueryZaloConnectionPageSwr(connectionId, {
        refreshInterval: (data: { readonly healthy: boolean } | undefined) =>
            data?.healthy === true ? 0 : ZALO_PAGE_POLL_MS,
    })
    return {
        slot: slotOfSwr(read),
        isMissing: read.error !== undefined && (isNotFoundFailure(read.error) || isInvalidFailure(read.error)),
        reload: () => void read.mutate(),
        mutate: read.mutate,
    }
}

/** What one read of the page answers. */
export type ZaloPageData = NonNullable<ReturnType<typeof useZaloPage>["slot"]["items"]>
