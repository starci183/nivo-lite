import type { GraphEvidence } from "@modules/domain/work-items"
import type { GraphDocument } from "../agent-graphs.contracts"

/** The sources the triggers of the graph accept, or null when none chose, and then every source counts. */
const acceptedBy = (document: GraphDocument): ReadonlySet<string> | null => {
    const chosen = document.nodes.flatMap((node) => (node.kind === "trigger" ? (node.triggerSources ?? []) : []))
    return chosen.length === 0 ? null : new Set(chosen)
}

/**
 * The evidence of a turn as the graph sees it: the setting on its trigger says which sources count, so each shop chooses its own. The core
 * only passes on what the trigger accepts; what an entry means is for the plug-in that reads it.
 */
export const evidenceAccepted = (
    document: GraphDocument,
    evidence: ReadonlyArray<GraphEvidence> | undefined,
): ReadonlyArray<GraphEvidence> | undefined => {
    const accepted = acceptedBy(document)
    if (evidence === undefined || accepted === null) return evidence
    return evidence.filter((entry) => accepted.has(entry.via))
}
