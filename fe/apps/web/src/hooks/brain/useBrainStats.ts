import { useKnowledgeSources, useWorkspaceMember } from "@/hooks/knowledge"
import { currentTime, figuresOf, needsMaintenance } from "@/modules/brain"
import type { BrainFigures } from "@/modules/brain"
import { useBrain } from "./useBrain"

/** What the figures of the Second Brain draw. */
interface BrainStats {
    readonly figures: BrainFigures
    /** Whether a scheduled value is due or a value in force has ended, and the person may bring the brain up to date. */
    readonly isMaintenanceDue: boolean
    readonly isLoading: boolean
}

/** The counts of the Second Brain (documents, facts, reviews, lessons, questions) and whether it needs tidying. */
export const useBrainStats = (): BrainStats => {
    const member = useWorkspaceMember()
    const { brain, isLoading } = useBrain()
    const { sources, isLoading: sourcesLoading } = useKnowledgeSources()
    const facts = brain?.facts ?? []
    return {
        figures: figuresOf({
            facts,
            lessons: brain?.lessons ?? [],
            documents: sources ?? [],
            extractions: brain?.extractions ?? [],
            gapsOpen: brain?.gapsOpen ?? 0,
        }),
        isMaintenanceDue: member.canWrite && needsMaintenance(facts, currentTime()),
        isLoading: member.isLoading || isLoading || sourcesLoading || brain === undefined,
    }
}
