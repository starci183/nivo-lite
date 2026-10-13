import { useCallback, useState, useSyncExternalStore } from "react"
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

const CHANGE_EVENT = "nivo-promo-dismissed"

const subscribe = (onChange: () => void): (() => void) => {
    window.addEventListener("storage", onChange)
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => {
        window.removeEventListener("storage", onChange)
        window.removeEventListener(CHANGE_EVENT, onChange)
    }
}

const readStored = (id: string): string => {
    try {
        return window.localStorage.getItem(dismissKey(id)) === "1" ? "1" : "0"
    } catch {
        return "0"
    }
}

/** Remembers a dismissed promo card in localStorage; safe when storage is blocked (the dismissal then lasts for this view only). */
export const useDismissed = (id: string): Dismissal => {
    const stored = useSyncExternalStore(
        subscribe,
        () => readStored(id),
        () => null,
    )
    const [inView, setInView] = useState(false)
    const dismiss = useCallback(() => {
        setInView(true)
        try {
            window.localStorage.setItem(dismissKey(id), "1")
            window.dispatchEvent(new Event(CHANGE_EVENT))
        } catch {
            setInView(true)
        }
    }, [id])
    return { ready: stored !== null, dismissed: inView || stored === "1", dismiss }
}
