"use client"

import { useFeatureReset } from "@/hooks/reuseables"
import { type HiringOwner, useHiringRun } from "@/hooks/hiring"

import { useMemo, useState } from "react"
import type { HiringWorkbenchData, CandidateView } from "@/hooks/hiringWire"
import { pipelineLanes, withdrawnCount, type PipelineLane } from "./hiringPipeline.shared"
import { useHiringMove } from "./useHiringMove"

/** The view `useHiringPipeline` returns. */
export interface HiringPipelineView {
    lanes: PipelineLane[]
    withdrawn: number
    dragId: string | null
    overStage: string | null
    rejecting: CandidateView | null
    isPending: boolean
    error: string | null
    clearError: () => void
    moveTo: (id: string, stage: string) => void
    startDrag: (id: string) => void
    endDrag: () => void
    overLane: (stage: string) => void
    leaveLane: (stage: string) => void
    dropOn: (stage: string, transferId: string) => void
    closeReject: () => void
}

/** The pipeline board of one job (or all): lanes, the drag in flight, the card asked to be rejected, and the moves. */
export const useHiringPipeline = (
    data: HiringWorkbenchData,
    jobId: string,
    owner?: HiringOwner,
): HiringPipelineView => {
    const run = useHiringRun(owner)
    const move = useHiringMove()
    const [dragId, setDragId] = useState<string | null>(null)
    const [overStage, setOverStage] = useState<string | null>(null)
    const [rejectingId, setRejectingId] = useState<string | null>(null)
    const lanes = useMemo(() => pipelineLanes(data.candidates, jobId), [data.candidates, jobId])
    const moveTo = (id: string, stage: string) => {
        const candidate = data.candidates.find((entry) => entry.id === id)
        if (candidate === undefined || candidate.stage === stage) return
        if (stage === "rejected") {
            setRejectingId(id)
            return
        }
        run.dispatch(() => move(id, stage))
    }
    useFeatureReset({
        isActive: owner?.isActive ?? true,
        isReady: true,
        scope: owner?.scope ?? "",
        onReset: () => {
            setDragId(null)
            setOverStage(null)
            setRejectingId(null)
        },
    })
    return {
        lanes,
        withdrawn: withdrawnCount(data.candidates, jobId),
        dragId,
        overStage,
        rejecting: data.candidates.find((candidate) => candidate.id === rejectingId) ?? null,
        isPending: run.isPending,
        error: run.error,
        clearError: run.clear,
        moveTo,
        startDrag: (id: string) => setDragId(id),
        endDrag: () => {
            setDragId(null)
            setOverStage(null)
        },
        overLane: (stage: string) => {
            if (dragId !== null) setOverStage(stage)
        },
        leaveLane: (stage: string) => setOverStage((current) => (current === stage ? null : current)),
        dropOn: (stage: string, transferId: string) => {
            const id = transferId || dragId
            setOverStage(null)
            setDragId(null)
            if (id !== null) moveTo(id, stage)
        },
        closeReject: () => setRejectingId(null),
    }
}
