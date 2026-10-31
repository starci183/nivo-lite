"use client"

import { useLayoutEffect, useRef, type RefObject } from "react"

/** Whenever the key changes the scroll owner of the chat (the thread band the returned ref is given to) opens at the newest message. */
export const useThreadScroll = (key: string): RefObject<HTMLDivElement | null> => {
    const ref = useRef<HTMLDivElement>(null)
    useLayoutEffect(() => {
        const owner = ref.current
        if (owner !== null) owner.scrollTop = owner.scrollHeight
    }, [key])
    return ref
}
