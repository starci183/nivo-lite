"use client"

import { useCallback, useState } from "react"
import useSWRMutation from "swr/mutation"
import { queryOfficeMessages } from "@/modules/api/graphql/queries/query-office-messages"
import { useQueryOfficeMessagesSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import type { DataSlot } from "@/modules/types"
import { OFFICE_PAGE_SIZE, OFFICE_POLL_MS, mergeMessages, toOfficeMessage } from "@/modules/office"
import type { OfficeMessage } from "@/modules/office"

/** The cursor of the earliest line read so far. */
interface ThreadCursor {
    readonly createdAt: string
    readonly id: string
}

/** The argument of the earlier-page read. */
interface CursorArg {
    readonly arg: ThreadCursor
}

/** The Office thread: the newest page, read again every few seconds, and the earlier pages the person asked for. */
export const useOfficeThread = (): {
    readonly slot: DataSlot<ReadonlyArray<OfficeMessage>>
    readonly reload: () => void
    readonly hasEarlier: boolean
    readonly isLoadingEarlier: boolean
    readonly loadEarlier: () => void
} => {
    const latest = useQueryOfficeMessagesSwr({ limit: OFFICE_PAGE_SIZE }, { refreshInterval: OFFICE_POLL_MS })
    const [earlier, setEarlier] = useState<ReadonlyArray<OfficeMessage>>([])
    const [cursor, setCursor] = useState<ThreadCursor | null | undefined>(undefined)
    const page = useSWRMutation("OFFICE_EARLIER_PAGE", async (_key: string, { arg }: CursorArg) => {
        const result = await queryOfficeMessages({ request: { before: arg, limit: OFFICE_PAGE_SIZE } })
        if (!result.data) throw new Error("officeMessages answered no data")
        return result.data.officeMessages
    })
    const next = cursor === undefined ? (latest.data?.next ?? null) : cursor
    const loadEarlier = useCallback(() => {
        if (next === null) return
        void page.trigger({ createdAt: next.createdAt, id: next.id }).then((read) => {
            setEarlier((current) => mergeMessages([current, read.messages.map(toOfficeMessage)]))
            setCursor(read.next ?? null)
        })
    }, [next, page])
    const newest = latest.data?.messages.map(toOfficeMessage)
    const joined = newest === undefined ? undefined : mergeMessages([earlier, newest])
    return {
        slot: slotOfSwr({ data: joined, error: latest.error, isLoading: latest.isLoading }),
        reload: () => void latest.mutate(),
        hasEarlier: next !== null,
        isLoadingEarlier: page.isMutating,
        loadEarlier,
    }
}
