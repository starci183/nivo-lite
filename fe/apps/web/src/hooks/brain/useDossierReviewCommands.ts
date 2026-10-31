"use client"

import { useDraftCommands } from "./useDraftCommands"
import type { DraftCommands } from "./useDraftCommands"
import { useFindingCommands } from "./useFindingCommands"
import type { FindingCommands } from "./useFindingCommands"

/** Every write of the dossier review: the findings and the remedy drafts. */
export type DossierReviewCommands = FindingCommands & DraftCommands

/**
 * The writes of the dossier review in one object: each toasts its outcome and, once it went through, refreshes exactly the
 * lists of findings, the summary and the draft; an approval also refreshes the dossiers and the documents it adds to.
 */
export const useDossierReviewCommands = (): DossierReviewCommands => {
    const findings = useFindingCommands()
    const drafts = useDraftCommands()
    return { ...findings, ...drafts, isPending: findings.isPending || drafts.isPending }
}
