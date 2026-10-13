import { useLayoutEffect, useRef } from "react"

/** A ref for the thread of a chat: whenever the key changes the scroll region around it opens at the newest message. */
export const useThreadScroll = (key: string) => {
    const threadRef = useRef<HTMLDivElement | null>(null)
    useLayoutEffect(() => {
        const owner = threadRef.current?.closest("[data-grammar-chat-workspace-scroll-owner]")
        if (owner) owner.scrollTop = owner.scrollHeight
    }, [key])
    return threadRef
}
