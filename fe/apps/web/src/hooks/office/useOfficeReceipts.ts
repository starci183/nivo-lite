"use client"

import { useCallback, useEffect, useRef } from "react"
import { useMutateMarkChatDeliveredSwr, useMutateMarkChatReadSwr } from "@/hooks/swr"
import { chatTargetOf } from "@/modules/office"

/** The newest line this client fetched, and the lines already acknowledged. */
interface ReceiptMemory {
    fetched: string | null
    delivered: string | null
    read: string | null
}

/**
 * Tells the back end which line this client fetched (delivered) and, while the tab is visible, which line it shows (read) for one
 * Hub room (null = the Office room). `onFetched` takes the newest fetched line id after each read of the thread; each line is
 * acknowledged once. The receipts are best effort: a failed one waits for the next line instead of raising a message.
 */
export const useOfficeReceipts = (room: string | null) => {
    const { trigger: deliver } = useMutateMarkChatDeliveredSwr()
    const { trigger: read } = useMutateMarkChatReadSwr()
    const memory = useRef<ReceiptMemory>({ fetched: null, delivered: null, read: null })

    const acknowledge = useCallback(() => {
        const id = memory.current.fetched
        if (id === null) return
        const key = `${room ?? ""}|${id}`
        const request = { ...chatTargetOf(room), messageId: id }
        if (memory.current.delivered !== key) {
            memory.current.delivered = key
            void deliver(request, { throwOnError: false })
        }
        if (document.visibilityState === "visible" && memory.current.read !== key) {
            memory.current.read = key
            void read(request, { throwOnError: false })
        }
    }, [room, deliver, read])

    const onFetched = useCallback(
        (lastMessageId: string | null) => {
            memory.current.fetched = lastMessageId
            acknowledge()
        },
        [acknowledge],
    )

    useEffect(() => {
        document.addEventListener("visibilitychange", acknowledge)
        return () => document.removeEventListener("visibilitychange", acknowledge)
    }, [acknowledge])

    return { onFetched }
}
