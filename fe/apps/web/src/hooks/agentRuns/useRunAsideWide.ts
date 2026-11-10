"use client"

import { useSyncExternalStore } from "react"

/** From this width the aside of a run is a column of the page, not a drawer. */
const WIDE_QUERY = "(min-width: 80rem)"

const subscribeWide = (notify: () => void): (() => void) => {
    const query = window.matchMedia(WIDE_QUERY)
    query.addEventListener("change", notify)
    return () => query.removeEventListener("change", notify)
}

const readWide = (): boolean => window.matchMedia(WIDE_QUERY).matches

const readWideOnServer = (): boolean => true

/** Whether the aside of the run stands beside the page (a desktop) rather than opening as a drawer. */
export const useRunAsideWide = (): boolean => useSyncExternalStore(subscribeWide, readWide, readWideOnServer)
