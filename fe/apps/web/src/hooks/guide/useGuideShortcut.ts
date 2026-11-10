"use client"

import { useEffect } from "react"

/** Ctrl+K (Cmd+K on a Mac) anywhere on the page runs `toggle`; the browser's own use of the chord is stopped. */
export const useGuideShortcut = (toggle: () => void): void => {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
                event.preventDefault()
                toggle()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [toggle])
}
