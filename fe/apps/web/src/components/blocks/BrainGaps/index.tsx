"use client"

import { useBrainBoard, useBrainGaps } from "@/hooks/brain"
import type { BrainGap } from "@/modules/types"
import { BrainGapsBase } from "./component"

/** A standalone unanswered-question region may receive an already resolved workbench read. */
interface BrainGapsProps {
    readonly gaps?: readonly BrainGap[]
    readonly answer?: "fact" | "public"
}

/** Keeps the public questions route and its exact answer destination on the shared atomic row model. */
export const BrainGaps = (props: BrainGapsProps) => {
    const board = useBrainBoard()
    const gaps = useBrainGaps(board, props)
    if (props.gaps === undefined && !board.canWrite) return null
    return <BrainGapsBase props={{ list: gaps.list }} on={{ retry: gaps.retry, action: gaps.dispatch }} />
}
