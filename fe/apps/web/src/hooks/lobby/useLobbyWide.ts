"use client"

import { useSyncExternalStore } from "react"

/** From this width the lobby draws its table beside the rail; under it the stacked rows, the invitations first. */
const WIDE_QUERY = "(min-width: 48rem)"

const subscribeWide = (notify: () => void): (() => void) => {
    const query = window.matchMedia(WIDE_QUERY)
    query.addEventListener("change", notify)
    return () => query.removeEventListener("change", notify)
}

const readWide = (): boolean => window.matchMedia(WIDE_QUERY).matches

const readWideOnServer = (): boolean => true

/** Whether the lobby has the room for its table (a desktop) rather than the phone's stacked rows. */
export const useLobbyWide = (): boolean => useSyncExternalStore(subscribeWide, readWide, readWideOnServer)
