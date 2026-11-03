"use client"
import { useLayoutEffect, useRef, useState } from "react"
/** Immutable render metadata: one identity for this scope and activation. */
interface FeatureIdentity {
    readonly isActive: boolean
    readonly scope: string
}
/** Every committed setup owns a distinct epoch, including a StrictMode effect replay. */
interface FeatureActivation {
    readonly identity: FeatureIdentity
}
type UseFeatureLifetimeResult = {
    identity: FeatureIdentity
    capture: () => () => boolean
}

/**
 * Captures local completion ownership at event start. Render consumes only identity; liveness is read only by event and
 * settlement code. Retiring an activation never cancels its remote effect or normal feedback and revalidation.
 */
export const useFeatureLifetime = (isActive: boolean, scope: string): UseFeatureLifetimeResult => {
    const [identity, setIdentity] = useState<FeatureIdentity>({ isActive, scope })
    if (identity.isActive !== isActive || identity.scope !== scope) {
        setIdentity({ isActive, scope })
    }
    const activation = useRef<FeatureActivation | null>(null)
    useLayoutEffect(() => {
        if (!identity.isActive) {
            activation.current = null
            return
        }
        const committed: FeatureActivation = { identity }
        activation.current = committed
        return () => {
            if (activation.current === committed) activation.current = null
        }
    }, [identity])
    return {
        identity,
        capture: () => {
            const captured = activation.current
            return (): boolean => captured !== null && captured.identity === identity && activation.current === captured
        },
    }
}
