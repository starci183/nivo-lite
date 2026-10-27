import { currentTime } from "@/modules/brain"
import { loadingSlot } from "@/hooks/slot"
import { useWorkspaceMember } from "@/hooks/knowledge"
import type { BrainExtraction, BrainFact, BrainGap, BrainLens, BrainLesson, DataSlot } from "@/modules/types"
import { useBrain } from "./useBrain"
import type { BrainView } from "./useBrain"

/** What a list of the Second Brain draws: its rows, whether the member may write, and whether it is still loading. */
interface BrainBoard {
    readonly facts: ReadonlyArray<BrainFact>
    readonly lessons: ReadonlyArray<BrainLesson>
    readonly gaps: ReadonlyArray<BrainGap>
    readonly lenses: ReadonlyArray<BrainLens>
    /** Where the reading of each document's facts stands. */
    readonly extractions: ReadonlyArray<BrainExtraction>
    /** Owners and managers write; everyone reads. */
    readonly canWrite: boolean
    /** The moment the page was read, in milliseconds: the age of a value is judged against it. */
    readonly nowMs: number
    /** The one read behind every list of the brain, and the membership it waits for: its status is drawn by the list's slot view. */
    readonly slot: DataSlot<BrainView>
    /** Reads the brain again: the retry of a failed list. */
    readonly reload: () => void
}

/** The shared Second Brain of the workspace with the membership of the person: every list of the page reads it, and the reads are shared. */
export const useBrainBoard = (): BrainBoard => {
    const member = useWorkspaceMember()
    const { brain, slot, reload } = useBrain()
    return {
        facts: brain?.facts ?? [],
        lessons: brain?.lessons ?? [],
        gaps: brain?.gaps ?? [],
        lenses: brain?.lenses ?? [],
        extractions: brain?.extractions ?? [],
        canWrite: member.canWrite,
        nowMs: currentTime(),
        slot: member.isLoading ? loadingSlot<BrainView>() : slot,
        reload,
    }
}
