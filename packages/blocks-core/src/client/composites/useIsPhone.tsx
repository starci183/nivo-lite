import { useSyncExternalStore } from "react"

/** Below 48rem the blocks draw the phone layout: cards stacked in a column instead of tables. */
const PHONE_QUERY = "(max-width: 47.99rem)"

const subscribe = (notify: () => void): (() => void) => {
    const query = window.matchMedia(PHONE_QUERY)
    query.addEventListener("change", notify)
    return () => query.removeEventListener("change", notify)
}

const read = (): boolean => window.matchMedia(PHONE_QUERY).matches

const readOnServer = (): boolean => false

/** Whether the screen is a phone; the server draws the wide layout. */
export const useIsPhone = (): boolean => useSyncExternalStore(subscribe, read, readOnServer)
