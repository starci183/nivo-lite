"use client"

import { useCallback, useState } from "react"

/** Copies a link to the clipboard and remembers which row it was for, so that row can say "copied". */
export const useHiringCopy = () => {
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const copy = useCallback(async (id: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedId(id)
        } catch {
            setCopiedId(null)
        }
    }, [])
    return { copiedId, copy }
}
