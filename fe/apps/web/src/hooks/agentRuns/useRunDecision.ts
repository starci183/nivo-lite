"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateDecideAgentRunStepSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"

/** What a person answers a decision with. */
type RunVerdict = "approve" | "retry" | "reject"

/** The answer to the decision a run waits on. */
interface RunDecisionData {
    readonly decide: (verdict: RunVerdict) => void
    readonly isDeciding: boolean
}

/** Answers the decision a run waits on; a refusal says why in words (the decision is closed, or the person may not decide it). */
export const useRunDecision = (installationId: string, runId: string): RunDecisionData => {
    const t = useTranslations("agentRuns")
    const runGraphQL = useGraphQLWithToast()
    const decideStep = useMutateDecideAgentRunStepSwr()
    const decide = useCallback(
        (verdict: RunVerdict) => {
            void runGraphQL(
                async () => {
                    const outcome = await decideStep.trigger({ installationId, runId, verdict })
                    if (!outcome.ok) {
                        // The verdicts the waiting decision takes come from the answer, never a guess.
                        const accepted = outcome.accepted ?? []
                        if (outcome.refusal === "option_not_offered" && accepted.length > 0)
                            throw new Error(t("decideNotOffered", { list: accepted.map((one) => t(`verdictWord_${one}`)).join(", ") }))
                        throw new Error(outcome.refusal === "forbidden" ? t("decideForbidden") : t("decideRefused"))
                    }
                },
                { showSuccessToast: false },
            )
        },
        [runGraphQL, decideStep, installationId, runId, t],
    )
    return { decide, isDeciding: decideStep.isMutating }
}
