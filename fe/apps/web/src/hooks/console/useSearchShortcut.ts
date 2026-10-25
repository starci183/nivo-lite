"use client"

import { useEffect, useRef } from "react"

/** Calls `open` when the reader presses Ctrl+K or Cmd+K anywhere on the page; the listener binds once and follows the latest `open`. */
export const useSearchShortcut = (open: () => void): void => {
    const openRef = useRef(open)
    useEffect(() => {
        openRef.current = open
    }, [open])
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                event.preventDefault()
                openRef.current()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])
}
