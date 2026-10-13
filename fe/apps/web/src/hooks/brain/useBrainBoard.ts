import { currentTime } from "@/modules/brain"
import { useWorkspaceMember } from "@/hooks/knowledge"
import type { BrainFact, BrainGap, BrainLens, BrainLesson } from "@/modules/types"
import { useBrain } from "./useBrain"

/** What a list of the Second Brain draws: its rows, whether the member may write, and whether it is still loading. */
interface BrainBoard {
    readonly facts: ReadonlyArray<BrainFact>
    readonly lessons: ReadonlyArray<BrainLesson>
    readonly gaps: ReadonlyArray<BrainGap>
    readonly lenses: ReadonlyArray<BrainLens>
    /** Owners and managers write; everyone reads. */
    readonly canWrite: boolean
    /** The moment the page was read, in milliseconds: the age of a value is judged against it. */
    readonly nowMs: number
    readonly isLoading: boolean
}

/** The shared Second Brain of the workspace with the membership of the person: every list of the page reads it, and the reads are shared. */
export const useBrainBoard = (): BrainBoard => {
    const member = useWorkspaceMember()
    const { brain, isLoading } = useBrain()
    return {
        facts: brain?.facts ?? [],
        lessons: brain?.lessons ?? [],
        gaps: brain?.gaps ?? [],
        lenses: brain?.lenses ?? [],
        canWrite: member.canWrite,
        nowMs: currentTime(),
        isLoading: member.isLoading || isLoading || brain === undefined,
    }
}
