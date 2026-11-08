"use client"

import { useMemo } from "react"
import { useQueryBrainSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { toBrainExtraction, toBrainFact, toBrainGap, toBrainLens, toBrainLesson } from "@/modules/brain"
import type { BrainExtraction, BrainFact, BrainGap, BrainLens, BrainLesson, DataSlot } from "@/modules/types"
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

/** The view `useBrain` returns. */
export interface BrainViewShape {
    brain: BrainView | undefined
    error: unknown
    isLoading: boolean
    slot: DataSlot<BrainView>
    reload: () => undefined
}

/** The `brain` query mapped to the domain shape; polls while a document reading is still on. */
export const useBrain = (): BrainViewShape => {
    const swrRead = useQueryBrainSwr()
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const brain = useMemo<BrainView | undefined>(
        () =>
            data === undefined
                ? undefined
                : {
                      facts: data.facts.map((item) => toBrainFact(item)),
                      lessons: data.lessons.map((item) => toBrainLesson(item)),
                      gaps: data.gaps.map((item) => toBrainGap(item)),
                      lenses: data.lenses.map((item) => toBrainLens(item)),
                      extractions: data.extractions.map((item) => toBrainExtraction(item)),
                      gapsOpen: data.gapsOpen,
                  },
        [data],
    )
    const slot = slotOfSwr({ data: brain, error: swrRead.error, isLoading })
    const reload = () => void swrRead.mutate()
    return { brain, error, isLoading, slot, reload }
}
