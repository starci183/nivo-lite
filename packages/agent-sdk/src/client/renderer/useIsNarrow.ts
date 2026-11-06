import { useSyncExternalStore } from "react"

/** Below 70rem (the wide pane breakpoint) the workbench has no aside column. */
const NARROW_QUERY = "(max-width: 69.99rem)"

const subscribe = (notify: () => void): (() => void) => {
    const query = window.matchMedia(NARROW_QUERY)
    query.addEventListener("change", notify)
    return () => query.removeEventListener("change", notify)
}

const read = (): boolean => window.matchMedia(NARROW_QUERY).matches

const readOnServer = (): boolean => false

/** Whether the workbench is narrower than its wide layout; the server draws the wide one. */
export const useIsNarrow = (): boolean => useSyncExternalStore(subscribe, read, readOnServer)
