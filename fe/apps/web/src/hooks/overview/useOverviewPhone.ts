"use client"

import { useSyncExternalStore } from "react"

/** Under this width the overview is a phone's: what needs the owner comes before the chart. */
const WIDE_QUERY = "(min-width: 48rem)"

const subscribe = (notify: () => void): (() => void) => {
    const query = window.matchMedia(WIDE_QUERY)
    query.addEventListener("change", notify)
    return () => query.removeEventListener("change", notify)
}

const readIsPhone = (): boolean => !window.matchMedia(WIDE_QUERY).matches

const readIsPhoneOnServer = (): boolean => false

/** Whether the screen is a phone's, so the page can put what needs the owner first. */
export const useOverviewPhone = (): boolean => useSyncExternalStore(subscribe, readIsPhone, readIsPhoneOnServer)
