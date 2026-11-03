"use client"

import { useEffect, useRef } from "react"

/** Actual owner identity and availability of a formerly conditionally mounted local controller. */
interface FeatureResetInput {
    readonly isActive: boolean
    readonly isReady: boolean
    readonly scope: string
    readonly onReset: () => void
}

/** The last committed activation; ordinary data and callback identities are deliberately absent. */
interface FeatureResetState {
    readonly isActive: boolean
    readonly isReady: boolean
    readonly scope: string
}

/** Resets local controller state at activation boundaries, never during an ordinary ready-data refresh. */
export const useFeatureReset = (input: FeatureResetInput): void => {
    const { isActive, isReady, scope, onReset } = input
    const previous = useRef<FeatureResetState | null>(null)
    useEffect(() => {
        const before = previous.current
        previous.current = { isActive, isReady, scope }
        const changedScope = before?.scope !== scope
        const leftReady = before?.isActive && before.isReady && (!isActive || !isReady)
        const enteredReady = isActive && isReady && (changedScope || !before?.isActive || !before.isReady)
        if (changedScope || leftReady || enteredReady) onReset()
    }, [isActive, isReady, scope, onReset])
}
