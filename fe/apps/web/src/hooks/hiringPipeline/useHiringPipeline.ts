"use client"

import { useMemo, useState } from "react"
import type { DragEvent } from "react"
import { useHiringRun } from "@/hooks/hiring"
import type { HiringWorkbenchData } from "@/hooks/hiringWire"
import { pipelineLanes, withdrawnCount } from "./hiringPipeline.shared"
import { useHiringMove } from "./useHiringMove"

/** The pipeline board of one job (or all): lanes, the drag in flight, the card asked to be rejected, and the moves. */
export const useHiringPipeline = (data: HiringWorkbenchData, jobId: string) => {
    const run = useHiringRun()
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
        void run.exec(() => move(id, stage))
    }
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
        startDrag: (id: string, event: DragEvent) => {
            event.dataTransfer.setData("text/plain", id)
            event.dataTransfer.effectAllowed = "move"
            setDragId(id)
        },
        endDrag: () => {
            setDragId(null)
            setOverStage(null)
        },
        overLane: (stage: string, event: DragEvent) => {
            if (dragId === null) return
            event.preventDefault()
            setOverStage(stage)
        },
        leaveLane: (stage: string) => setOverStage((current) => (current === stage ? null : current)),
        dropOn: (stage: string, event: DragEvent) => {
            event.preventDefault()
            const id = event.dataTransfer.getData("text/plain") || dragId
            setOverStage(null)
            setDragId(null)
            if (id !== null) moveTo(id, stage)
        },
        closeReject: () => setRejectingId(null),
    }
}
