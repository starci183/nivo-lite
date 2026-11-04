import { useGraphQLWithToast } from "@/modules/toast"
import { editsOf } from "./salesdecisions.shared"
import type { SalesDecisionsControllerInput } from "./salesdecisions.shared"

/** The verdict a person gives a pending decision. */
export type Decision = "approved" | "rejected"

/** Sends the decision to the draft of an execution or to the work item, with the edits the person typed when approving. */
const sendDecision = (
    input: SalesDecisionsControllerInput,
    item: SalesDecisionsControllerInput["pending"][number],
    decision: Decision,
) => {
    const { actions, typed } = input
    const draft = (typed.drafts[item.id] ?? item.draft).trim()
    const edited = decision === "approved" && typed.editing[item.id] && draft !== item.draft ? draft : undefined
    if (item.source === "execution" && item.executionId)
        return actions.decideDraft({ id: item.executionId, decision, editedDraft: edited })
    return actions.decideWorkItem({
        id: item.id,
        decision,
        edits: decision === "approved" ? editsOf(item, typed) : undefined,
    })
}

/** Runs the same validated decision command, fencing only the local result of a retired panel. */
export const useSalesDecide = (input: SalesDecisionsControllerInput): ((id: string, decision: Decision) => void) => {
    const runGraphQL = useGraphQLWithToast()
    const { t, pending, decisionForm, setBusy, setErrors, capture } = input
    const decide = async (id: string, decision: Decision) => {
        const isCurrent = capture()
        if (!isCurrent()) return
        const item = pending.find((candidate) => candidate.id === id)
        if (item === undefined) return
        if (decision === "approved") {
            const error = decisionForm.validateDecision(item)
            if (error !== undefined) {
                setErrors((previous) => ({ ...previous, [id]: error }))
                return
            }
            const valid = await decisionForm.validateForm(item)
            if (!isCurrent()) return
            if (!valid) {
                setErrors((previous) => ({ ...previous, [id]: t("salesDecisionInvalid") }))
                return
            }
        }
        setErrors((previous) => ({ ...previous, [id]: "" }))
        setBusy({ id, decision })
        const result = await sendDecision(input, item, decision)
        if (!isCurrent()) return
        if (result !== undefined) decisionForm.finish(id)
        else {
            setErrors((previous) => ({ ...previous, [id]: t("loadFailedBody") }))
            setBusy(null)
        }
    }
    return (id, decision) => {
        decide(id, decision).catch((error: unknown) =>
            runGraphQL(() => Promise.reject(error), { showSuccessToast: false }),
        )
    }
}
