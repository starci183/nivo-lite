import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "swr"
import { useMutateDecideExecutionSwr } from "@/hooks/swr/api/graphql/mutations/useMutateDecideExecutionSwr"
import { useGraphQLWithToast } from "@/modules/toast"

/** What a person can decide about a draft. */
export type ExecutionDecision = "approved" | "rejected"

/** Cache keys that show a draft or the work it belongs to. */
const showsDecisions = (key: unknown): boolean => {
    const name = Array.isArray(key) ? key[0] : key
    return typeof name === "string" && /LEAD|WORK_ITEM|APPROVAL|DECISION|OFFICE|RESPONSIBILIT/.test(name)
}

/** Approves (optionally with an edited text) or rejects a draft through the back end and toasts the outcome; what shows drafts is read again. */
export const useDecideExecution = () => {
    const t = useTranslations("approval")
    const runGraphQL = useGraphQLWithToast()
    const { trigger } = useMutateDecideExecutionSwr()
    const decide = useCallback(
        async (executionId: string, decision: ExecutionDecision, editedDraft?: string): Promise<boolean> => {
            const decided = await runGraphQL(() => trigger({ executionId, decision, editedDraft }), {
                successMessage: decision === "approved" ? t("decisionApproved") : t("decisionRejected"),
            })
            if (decided === undefined) return false
            await mutate(showsDecisions)
            return true
        },
        [runGraphQL, trigger, t],
    )
    return { decide }
}
