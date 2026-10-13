import { useState } from "react"
import { useHiringRun } from "@/hooks/hiring"
import { REASON_MIN } from "./hiringPipeline.shared"
import { useHiringMove } from "./useHiringMove"

/** The reason being typed before a candidate is rejected, and the move that carries it; `onDone` runs once the back end took the rejection. */
export const useHiringReject = (onDone: () => void) => {
    const run = useHiringRun()
    const move = useHiringMove()
    const [reason, setReason] = useState("")
    return {
        reason,
        setReason,
        canConfirm: reason.trim().length >= REASON_MIN,
        isPending: run.isPending,
        error: run.error,
        confirm: async (candidateId: string) => {
            const moved = await run.exec(() => move(candidateId, "rejected", reason.trim()))
            if (moved === undefined) return
            setReason("")
            onDone()
        },
        reset: () => {
            setReason("")
            run.clear()
        },
    }
}
