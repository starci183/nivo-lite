"use client"

import { slotOfSwr } from "@/hooks/slot"
import { useQueryOfficeMessagesSwr } from "@/hooks/swr"
import { OFFICE_PAGE_SIZE, OFFICE_POLL_MS, mergeMessages, toOfficeMessage } from "@/modules/office"
import type { OfficeMessage } from "@/modules/office"
import type { DataSlot } from "@/modules/types"
import { useCallback, useState } from "react"

/** The cursor of the earliest line read so far. */
interface ThreadCursor {
    readonly createdAt: string
    readonly id: string
}

/** The earlier pages read in one room. */
interface EarlierPages {
    readonly room: string | null
    readonly lines: ReadonlyArray<OfficeMessage>
    readonly cursor: ThreadCursor | null | undefined
}

/**
 * The thread of one Hub room (null = the Office room, every line): the newest page, read again every few seconds, and the earlier
 * pages the person asked for in that room.
 */
export const useOfficeThread = (
    room: string | null,
): {
    readonly slot: DataSlot<ReadonlyArray<OfficeMessage>>
    readonly reload: () => void
    readonly hasEarlier: boolean
    readonly isLoadingEarlier: boolean
    readonly loadEarlier: () => void
} => {
    const latest = useQueryOfficeMessagesSwr({ limit: OFFICE_PAGE_SIZE, room }, { refreshInterval: OFFICE_POLL_MS })
    const [pages, setPages] = useState<EarlierPages>({ room, lines: [], cursor: undefined })
    const current: EarlierPages = pages.room === room ? pages : { room, lines: [], cursor: undefined }
    const page = latest.earlier
    const next = current.cursor === undefined ? (latest.data?.next ?? null) : current.cursor
    const loadEarlier = useCallback(() => {
        if (next === null) return
        void page.trigger({ before: { createdAt: next.createdAt, id: next.id }, room }).then((read) => {
            setPages((was) => ({
                room,
                lines: mergeMessages([was.room === room ? was.lines : [], read.messages.map(toOfficeMessage)]),
                cursor: read.next ?? null,
            }))
        })
    }, [next, page, room])
    const newest = latest.data?.messages.map(toOfficeMessage)
    const joined = newest === undefined ? undefined : mergeMessages([current.lines, newest])
    return {
        slot: slotOfSwr({ data: joined, error: latest.error, isLoading: latest.isLoading }),
        reload: () => void latest.mutate(),
        hasEarlier: next !== null,
        isLoadingEarlier: page.isMutating,
        loadEarlier,
    }
}
