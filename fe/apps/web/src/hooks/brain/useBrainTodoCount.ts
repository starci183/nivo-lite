"use client"

import { reviewBoardOf, todoCountOf } from "@/modules/brain"
import { useBrain } from "./useBrain"
import { useDossierReviewSummary } from "./useDossierReviewSummary"

/** What needs the owner: findings still open or confirmed, facts waiting and customer questions, as the one number the tab and the rail show. */
export const useBrainTodoCount = (): number => {
    const { brain } = useBrain()
    const { activeCount } = useDossierReviewSummary()
    return todoCountOf({
        findings: activeCount,
        factCards: reviewBoardOf(brain?.facts ?? []).cards,
        questions: brain?.gaps.length ?? 0,
    })
}
