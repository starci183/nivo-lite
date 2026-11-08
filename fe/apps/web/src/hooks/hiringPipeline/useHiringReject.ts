"use client"

import { useFeatureReset, useFeatureLifetime } from "@/hooks/reuseables"
import { type HiringOwner, useHiringRun } from "@/hooks/hiring"

import { useState, type Dispatch, type SetStateAction } from "react"
import { REASON_MIN } from "./hiringPipeline.shared"
import { useHiringMove } from "./useHiringMove"

/** The view `useHiringReject` returns. */
export interface HiringRejectView {
    reason: string
    setReason: Dispatch<SetStateAction<string>>
    canConfirm: boolean
    isPending: boolean
    error: string | null
    confirm: (candidateId: string) => void
    reset: () => void
}

/** The reason being typed before a candidate is rejected, and the move that carries it; `onDone` runs once the back end took the rejection. */
export const useHiringReject = (onDone: () => void, owner?: HiringOwner): HiringRejectView => {
    const run = useHiringRun(owner)
    const lifetime = useFeatureLifetime(owner?.isActive ?? true, owner?.scope ?? "")
    const move = useHiringMove()
    const [reason, setReason] = useState("")
    useFeatureReset({
        isActive: owner?.isActive ?? true,
        isReady: true,
        scope: owner?.scope ?? "",
        onReset: () => {
            setReason("")
        },
    })
    return {
        reason,
        setReason,
        canConfirm: reason.trim().length >= REASON_MIN,
        isPending: run.isPending,
        error: run.error,
        confirm: (candidateId: string) => {
            const isCurrent = lifetime.capture()
            if (!isCurrent()) return
            run.dispatch(
                () => move(candidateId, "rejected", reason.trim()),
                undefined,
                () => {
                    if (!isCurrent()) return
                    setReason("")
                    onDone()
                },
            )
        },
        reset: () => {
            setReason("")
            run.clear()
        },
    }
}
