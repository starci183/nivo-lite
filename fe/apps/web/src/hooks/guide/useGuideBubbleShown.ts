"use client"

import { useSyncExternalStore } from "react"
import { guideBubbleShown, rememberGuideBubbleShown, subscribeGuideBubbleShown } from "@/modules/storage"

/** Whether the floating assistant button is shown and the command that changes it. */
type GuideBubbleChoice = {
    readonly isShown: boolean
    readonly setShown: (shown: boolean) => void
}

/** The assistant button's choice, remembered per browser; hidden on the server, until hydration and until switched on. */
export const useGuideBubbleShown = (): GuideBubbleChoice => ({
    isShown: useSyncExternalStore(subscribeGuideBubbleShown, guideBubbleShown, () => false),
    setShown: rememberGuideBubbleShown,
})
