"use client"

import { useCallback } from "react"
import { useMutateMoveHiringCandidateSwr } from "@/hooks/swr"

/** Moves a candidate to a stage; a rejection carries the manager's reason. */
export const useHiringMove = (): ((
    id: string,
    stage: string,
    reason?: string,
) => Promise<{
    stage: string
}>) => {
    const { trigger } = useMutateMoveHiringCandidateSwr()
    return useCallback(
        (id: string, stage: string, reason?: string) =>
            trigger({ id, stage, ...(reason === undefined ? {} : { reason }) }),
        [trigger],
    )
}
