"use client"

import { useCallback, useEffect, useRef } from "react"
import { useMutateMarkChatDeliveredSwr, useMutateMarkChatReadSwr } from "@/hooks/swr"
import { chatTargetOf } from "@/modules/office"

/** The newest fetched line retains its room so a room switch cannot acknowledge the previous thread. */
interface ReceiptMemory {
    fetched: { readonly room: string | null; readonly id: string } | null
    delivered: string | null
    read: string | null
}

/**
 * Acknowledges fetched lines independently of visibility. A read additionally requires the thread on screen in the visible,
 * focused document. Focus and frame changes can mark an already fetched line read without waiting for another read.
 */
export const useOfficeReceipts = (room: string | null, isThreadVisible: boolean, onRead: () => void) => {
    const { trigger: deliver } = useMutateMarkChatDeliveredSwr()
    const { trigger: read } = useMutateMarkChatReadSwr()
    const memory = useRef<ReceiptMemory>({ fetched: null, delivered: null, read: null })

    const acknowledge = useCallback(() => {
        const fetched = memory.current.fetched
        if (fetched?.room !== room) return
        const key = `${room ?? ""}|${fetched.id}`
        const request = { ...chatTargetOf(room), messageId: fetched.id }
        if (memory.current.delivered !== key) {
            memory.current.delivered = key
            void deliver(request, {
                throwOnError: false,
                onError: () => {
                    if (memory.current.delivered === key) memory.current.delivered = null
                },
            })
        }
        if (
            isThreadVisible &&
            document.visibilityState === "visible" &&
            document.hasFocus() &&
            memory.current.read !== key
        ) {
            memory.current.read = key
            void read(request, {
                throwOnError: false,
                onSuccess: onRead,
                onError: () => {
                    if (memory.current.read === key) memory.current.read = null
                },
            })
        }
    }, [room, isThreadVisible, deliver, read, onRead])

    const onFetched = useCallback(
        (lastMessageId: string | null) => {
            memory.current.fetched = lastMessageId === null ? null : { room, id: lastMessageId }
            acknowledge()
        },
        [room, acknowledge],
    )

    useEffect(() => {
        acknowledge()
        document.addEventListener("visibilitychange", acknowledge)
        window.addEventListener("focus", acknowledge)
        return () => {
            document.removeEventListener("visibilitychange", acknowledge)
            window.removeEventListener("focus", acknowledge)
        }
    }, [acknowledge])

    return { onFetched }
}
