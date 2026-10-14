"use client"

import { useLayoutEffect } from "react"

const SCROLL_OWNER = "[data-grammar-chat-workspace-scroll-owner]"

/** Whenever the key changes the scroll region of the chat opens at the newest message. */
export const useThreadScroll = (key: string): void => {
    useLayoutEffect(() => {
        const owner = document.querySelector(SCROLL_OWNER)
        if (owner) owner.scrollTop = owner.scrollHeight
    }, [key])
}
