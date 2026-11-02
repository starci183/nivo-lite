"use client"

import { useState, useTransition } from "react"
import { useFeatureLifetime } from "@/hooks/reuseables"

/** One actual command keeps its own completion ownership until that command settles. */
interface BookingOperation {
    readonly identity: ReturnType<typeof useFeatureLifetime>["identity"]
    readonly isCurrent: () => boolean
}

/**
 * Runs booking work with React's transition priority while tracking busy state per active lifetime. An older command
 * settling can remove only itself; it cannot keep a newly reopened editor busy or clear that editor's current work.
 */
export const useBookingTransition = (isActive: boolean, scope: string) => {
    const lifetime = useFeatureLifetime(isActive, scope)
    const [, startTransition] = useTransition()
    const [operations, setOperations] = useState<ReadonlyArray<BookingOperation>>([])
    const run = (job: (isCurrent: () => boolean) => Promise<void>) => {
        const operation: BookingOperation = { identity: lifetime.identity, isCurrent: lifetime.capture() }
        setOperations((current) => [...current, operation])
        startTransition(async () => {
            try {
                await job(operation.isCurrent)
            } finally {
                setOperations((current) => current.filter((entry) => entry !== operation))
            }
        })
    }
    return {
        isPending: isActive && operations.some((operation) => operation.identity === lifetime.identity),
        run,
    }
}
