"use client"

import { useEffect } from "react"

/** Calls `open` when the reader presses Ctrl+K or Cmd+K anywhere on the page. */
export const useSearchShortcut = (open: () => void): void => {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                event.preventDefault()
                open()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open])
}
