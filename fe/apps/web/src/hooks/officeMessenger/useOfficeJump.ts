"use client"

import { useCallback, useEffect, useState } from "react"
import { approvalCardAnchor, exceptionCardAnchor, resultCardAnchor } from "@/modules/office"

const FOCUS_MS = 2400

/** The card a jump points at: its id (to highlight) and the DOM id (to scroll to). */
interface JumpTarget {
    readonly id: string
    readonly anchor: string
}

/** Scrolls a card of the thread into view and highlights it for a moment. */
export const useOfficeJump = () => {
    const [target, setTarget] = useState<JumpTarget | null>(null)

    useEffect(() => {
        if (target === null) return undefined
        document.getElementById(target.anchor)?.scrollIntoView({ block: "center", behavior: "smooth" })
        const timer = window.setTimeout(() => setTarget(null), FOCUS_MS)
        return () => window.clearTimeout(timer)
    }, [target])

    const jumpApproval = useCallback((id: string) => setTarget({ id, anchor: approvalCardAnchor(id) }), [])
    const jumpException = useCallback((id: string) => setTarget({ id, anchor: exceptionCardAnchor(id) }), [])
    const jumpCard = useCallback((id: string) => setTarget({ id, anchor: resultCardAnchor(id) }), [])
    return { focusedId: target?.id ?? null, jumpApproval, jumpException, jumpCard }
}
