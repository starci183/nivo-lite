"use client"

import { useCallback, useLayoutEffect, useMemo, useRef } from "react"

/** Tracks the workspace and lifetime of asynchronous payment-order calls. */
export const usePaymentOrderInvocation = (workspaceId: string | undefined) => {
    const invocation = useRef({ workspaceId, sequence: 0, live: true })
    useLayoutEffect(() => {
        const current = invocation.current
        current.workspaceId = workspaceId
        current.live = true
        return () => {
            current.live = false
            current.sequence += 1
        }
    }, [workspaceId])
    /** The current call state, read only inside callbacks. */
    const read = useCallback(() => ({ ...invocation.current }), [])
    /** Starts a new call and returns its sequence. */
    const begin = useCallback((): number => {
        invocation.current.sequence += 1
        return invocation.current.sequence
    }, [])
    return useMemo(() => ({ read, begin }), [read, begin])
}
