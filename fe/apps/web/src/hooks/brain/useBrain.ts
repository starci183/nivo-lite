"use client"

import { useMemo } from "react"
import { useQueryBrainSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { toBrainExtraction, toBrainFact, toBrainGap, toBrainLens, toBrainLesson } from "@/modules/brain"
import type { BrainExtraction, BrainFact, BrainGap, BrainLens, BrainLesson } from "@/modules/types"
import { readError } from "@/hooks/workspaceread"

/** The shared Second Brain of the active workspace, in the shape the blocks know. */
export interface BrainView {
    readonly facts: ReadonlyArray<BrainFact>
    readonly lessons: ReadonlyArray<BrainLesson>
    readonly gaps: ReadonlyArray<BrainGap>
    readonly lenses: ReadonlyArray<BrainLens>
    readonly extractions: ReadonlyArray<BrainExtraction>
    readonly gapsOpen: number
}

/** The `brain` query mapped to the domain shape; polls while a document reading is still on. */
export const useBrain = () => {
    const swrRead = useQueryBrainSwr()
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const brain = useMemo<BrainView | undefined>(
        () =>
            data === undefined
                ? undefined
                : {
                      facts: data.facts.map(toBrainFact),
                      lessons: data.lessons.map(toBrainLesson),
                      gaps: data.gaps.map(toBrainGap),
                      lenses: data.lenses.map(toBrainLens),
                      extractions: data.extractions.map(toBrainExtraction),
                      gapsOpen: data.gapsOpen,
                  },
        [data],
    )
    const slot = slotOfSwr({ data: brain, error: swrRead.error, isLoading })
    const reload = () => void swrRead.mutate()
    return { brain, error, isLoading, slot, reload }
}
