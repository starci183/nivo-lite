"use client"

import { useCallback, useState } from "react"

/** The one pane a phone shows while the grid is narrow. */
export type PanePhone = "list" | "main"

/** Which pane a phone shows and the two commands that change it. */
type UsePanePhoneResult = {
    readonly phone: PanePhone
    /** A phone returns to the list (the back control of the main pane's head). */
    readonly showList: () => void
    /** A phone opens the main pane (a row was chosen). */
    readonly showMain: () => void
}

/**
 * The phone view of a list and main pane frame: the list first, the main pane once something is opened. A page whose open item
 * lives in the address (a route per record) derives `phone` from the route instead and does not use this hook.
 */
export const usePanePhone = (initial: PanePhone = "list"): UsePanePhoneResult => {
    const [phone, setPhone] = useState<PanePhone>(initial)
    return {
        phone,
        showList: useCallback((): void => setPhone("list"), []),
        showMain: useCallback((): void => setPhone("main"), []),
    }
}
