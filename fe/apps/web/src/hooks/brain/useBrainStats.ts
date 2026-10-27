import { useKnowledgeSources, useWorkspaceMember } from "@/hooks/knowledge"
import { loadingSlot, mapSlot } from "@/hooks/slot"
import { currentTime, figuresOf, needsMaintenance } from "@/modules/brain"
import type { BrainFigures } from "@/modules/brain"
import type { DataSlot } from "@/modules/types"
import { useBrain } from "./useBrain"

/** What the figures of the Second Brain draw. */
export interface BrainStats {
    readonly figures: BrainFigures
    /** How many agents read from the brain: one lens per kind of agent in use. */
    readonly agents: number
    /** Owners and managers decide what waits for review; others only read. */
    readonly canDecide: boolean
    /** Whether a scheduled value is due or a value in force has ended, and the person may bring the brain up to date. */
    readonly isMaintenanceDue: boolean
}

/** The counts of the Second Brain (documents, facts, reviews, lessons, questions) and whether it needs tidying. */
export const useBrainStats = () => {
    const member = useWorkspaceMember()
    const { brain, slot: brainSlot, reload } = useBrain()
    const { sources, isLoading: sourcesLoading } = useKnowledgeSources()
    const facts = brain?.facts ?? []
    const stats: BrainStats = {
        agents: brain?.lenses.length ?? 0,
        canDecide: member.canWrite,
        figures: figuresOf({
            facts,
            lessons: brain?.lessons ?? [],
            documents: sources ?? [],
            gapsOpen: brain?.gapsOpen ?? 0,
        }),
        isMaintenanceDue: member.canWrite && needsMaintenance(facts, currentTime()),
    }
    const slot: DataSlot<BrainStats> =
        member.isLoading || sourcesLoading ? loadingSlot<BrainStats>() : mapSlot(brainSlot, () => stats)
    return { ...stats, slot, reload }
}
