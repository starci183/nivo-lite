"use client"

import { useMemo } from "react"
import { useQueryBrainSwr } from "@/hooks/swr"
import { toBrainExtraction, toBrainFact, toBrainGap, toBrainLens, toBrainLesson } from "@/modules/brain"
import type { BrainExtraction, BrainFact, BrainGap, BrainLens, BrainLesson } from "@/modules/types"

/** The shared Second Brain of the active workspace, in the shape the blocks know. */
interface BrainView {
    readonly facts: ReadonlyArray<BrainFact>
    readonly lessons: ReadonlyArray<BrainLesson>
    readonly gaps: ReadonlyArray<BrainGap>
    readonly lenses: ReadonlyArray<BrainLens>
    readonly extractions: ReadonlyArray<BrainExtraction>
    readonly gapsOpen: number
}

/** The `brain` query mapped to the domain shape; polls while a document reading is still on. */
export const useBrain = () => {
    const { data, error, isLoading } = useQueryBrainSwr()
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
    return { brain, error, isLoading }
}
