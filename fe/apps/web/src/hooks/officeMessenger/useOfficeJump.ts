"use client"

import { useCallback, useEffect, useState } from "react"
import { approvalCardAnchor, exceptionCardAnchor, resultCardAnchor } from "@/modules/office"
import type { OfficeWaiting } from "@/modules/office"

const FOCUS_MS = 2400

/** The card a jump points at: its id (to highlight) and the DOM id (to scroll to). */
interface JumpTarget {
    readonly id: string
    readonly anchor: string
}

type UseOfficeJumpResult = {
    focusedId: string | null
    jumpApproval: (id: string) => void
    jumpException: (id: string) => void
    jumpCard: (id: string) => void
    jumpWaiting: (waiting: OfficeWaiting | null) => void
}

/** Scrolls a card of the thread into view and highlights it for a moment. */
export const useOfficeJump = (): UseOfficeJumpResult => {
    const [target, setTarget] = useState<JumpTarget | null>(null)

    useEffect(() => {
        if (target === null) return undefined
        document.getElementById(target.anchor)?.scrollIntoView({ block: "center", behavior: "smooth" })
        const timer = window.setTimeout(() => setTarget(null), FOCUS_MS)
        return () => window.clearTimeout(timer)
    }, [target])

    const jumpApproval = useCallback((id: string): void => setTarget({ id, anchor: approvalCardAnchor(id) }), [])
    const jumpException = useCallback((id: string): void => setTarget({ id, anchor: exceptionCardAnchor(id) }), [])
    const jumpCard = useCallback((id: string): void => setTarget({ id, anchor: resultCardAnchor(id) }), [])
    const jumpWaiting = useCallback(
        (waiting: OfficeWaiting | null): void => {
            if (waiting === null) return
            if (waiting.kind === "approval") jumpApproval(waiting.id)
            else jumpException(waiting.id)
        },
        [jumpApproval, jumpException],
    )
    return { focusedId: target?.id ?? null, jumpApproval, jumpException, jumpCard, jumpWaiting }
}
