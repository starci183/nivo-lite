"use client"

import { useSyncExternalStore } from "react"

const PHONE_QUERY = "(max-width: 47.99rem)"

const subscribe = (notify: () => void): (() => void) => {
    const query = window.matchMedia(PHONE_QUERY)
    query.addEventListener("change", notify)
    return () => query.removeEventListener("change", notify)
}

const read = (): boolean => window.matchMedia(PHONE_QUERY).matches

const readOnServer = (): boolean => false

/** Whether the screen is a phone: below 48rem the conversation list is a drawer and the head carries the shorter words. */
export const useAgentChatIsPhone = (): boolean => useSyncExternalStore(subscribe, read, readOnServer)
