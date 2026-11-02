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
    const previous = useRef<FeatureResetState | null>(null)
    useEffect(() => {
        const before = previous.current
        previous.current = { isActive: input.isActive, isReady: input.isReady, scope: input.scope }
        const changedScope = before === null || before.scope !== input.scope
        const leftReady = before !== null && before.isActive && before.isReady && (!input.isActive || !input.isReady)
        const enteredReady =
            input.isActive && input.isReady && (before === null || changedScope || !before.isActive || !before.isReady)
        if (changedScope || leftReady || enteredReady) input.onReset()
    }, [input.isActive, input.isReady, input.scope, input.onReset])
}
