"use client"

import { useRef } from "react"

/** The single-flight lock of the approve and reject decisions. */
export interface DecisionLock {
    readonly acquire: () => boolean
    readonly release: () => void
}

/** A decision lock: acquire answers false while another decision holds it. */
export const useAccountingDecisionLock = (): DecisionLock => {
    const held = useRef(false)
    return {
        acquire: () => {
            if (held.current) return false
            held.current = true
            return true
        },
        release: () => {
            held.current = false
        },
    }
}
