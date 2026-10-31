"use client"

import { useQueryDossierReviewSummarySwr } from "@/hooks/swr"
import type { DossierReviewRecord } from "@/modules/brain"

/** Why the last review run read nothing with AI: no credits, or the day's allowance used. */
export type AiNotice = "credits" | "budget"

/** What the review of the dossiers gives a block. */
interface DossierReviewSummary {
    /** The reads of the summary are in: the counts below are real. */
    readonly isReady: boolean
    readonly isFailed: boolean
    /** A review run is queued or going: the summary is read again every few seconds meanwhile. */
    readonly isRunning: boolean
    /** Findings that still need somebody: open and confirmed. */
    readonly activeCount: number
    readonly draftsAwaiting: number
    readonly aiNotice: AiNotice | null
    /** What the review computed for one dossier; undefined when it has not looked at it yet. */
    readonly reviewOf: (dossierId: string) => DossierReviewRecord | undefined
    readonly reload: () => void
}

/** The aiState of a run that skipped the AI pass, by why. */
const NOTICE_OF_AI_STATE: Readonly<Record<string, AiNotice>> = { skipped_credits: "credits", skipped_budget: "budget" }

/** The counts and the per-dossier status of the dossier review, read again while a run is going. */
export const useDossierReviewSummary = (): DossierReviewSummary => {
    const read = useQueryDossierReviewSummarySwr()
    const summary = read.data
    const aiState = summary?.latestRun?.aiState
    return {
        isReady: summary !== undefined,
        isFailed: summary === undefined && read.error !== undefined,
        isRunning: summary?.isRunning === true,
        activeCount: (summary?.open ?? 0) + (summary?.confirmed ?? 0),
        draftsAwaiting: summary?.draftsAwaiting ?? 0,
        aiNotice: aiState === null || aiState === undefined ? null : (NOTICE_OF_AI_STATE[aiState] ?? null),
        reviewOf: (dossierId) => summary?.dossiers.find((one) => one.dossierId === dossierId),
        reload: () => void read.mutate(),
    }
}
