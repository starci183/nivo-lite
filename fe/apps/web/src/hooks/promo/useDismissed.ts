import { useCallback, useState, useSyncExternalStore } from "react"
import { readDismissed, subscribeDismissed, writeDismissed } from "@/modules/dismissals"
import { dismissKey } from "@/modules/promo"

/** What {@link useDismissed} answers. */
export interface Dismissal {
    /** False until the stored choice was read in the browser. */
    readonly ready: boolean
    /** True when the reader dismissed the card. */
    readonly dismissed: boolean
    /** Dismisses the card and remembers it. */
    readonly dismiss: () => void
}

/** Remembers a dismissed promo card in localStorage; safe when storage is blocked (the dismissal then lasts for this view only). */
export const useDismissed = (id: string): Dismissal => {
    const stored = useSyncExternalStore(
        subscribeDismissed,
        () => (readDismissed(dismissKey(id)) ? "1" : "0"),
        () => null,
    )
    const [inView, setInView] = useState(false)
    const dismiss = useCallback(() => {
        setInView(true)
        writeDismissed(dismissKey(id))
    }, [id])
    return { ready: stored !== null, dismissed: inView || stored === "1", dismiss }
}
