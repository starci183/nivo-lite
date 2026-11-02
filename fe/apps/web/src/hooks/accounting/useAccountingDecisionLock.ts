"use client"
import { useRef } from "react"
import { useFeatureLifetime } from "@/hooks/reuseables"
/** The exact successful acquisition owns its release, even after another activation acquires. */
export interface DecisionLease {
    readonly identity: ReturnType<typeof useFeatureLifetime>["identity"]
    readonly isCurrent: () => boolean
}
/** Approve and reject share a single-flight lock for their current committed activation. */
export interface DecisionLock {
    readonly acquire: () => DecisionLease | undefined
    readonly release: (lease: DecisionLease) => void
}
/** Refuses duplicate live decisions and compare-releases only the supplied originating lease. */
export const useAccountingDecisionLock = (isActive: boolean, scope: string): DecisionLock => {
    const lifetime = useFeatureLifetime(isActive, scope)
    const held = useRef<DecisionLease | null>(null)
    return {
        acquire: () => {
            const isCurrent = lifetime.capture()
            if (!isCurrent() || held.current?.isCurrent()) return undefined
            const lease: DecisionLease = { identity: lifetime.identity, isCurrent }
            held.current = lease
            return lease
        },
        release: (lease) => {
            if (held.current === lease) held.current = null
        },
    }
}
