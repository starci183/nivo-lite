import type { useTranslations } from "next-intl"
import type { ApprovalCardView } from "@/components/composites/ApprovalCard"
import type { useApprovalDecision } from "@/hooks/approval"
import type { ExecutionRecord, LeadJourney } from "@/modules/types"

/** Inputs needed to build the LeadExecutionContent section. */
interface BuildExecutionDraftViewContext {
    readonly draft: ExecutionRecord
    readonly loaded: LeadJourney
    readonly t: ReturnType<typeof useTranslations<"lead">>
    readonly a: ReturnType<typeof useTranslations<"approval">>
    readonly agent: ApprovalCardView["agent"]
    readonly isWaiting: boolean
    readonly approval: ReturnType<typeof useApprovalDecision>
    readonly decidedAt: string
}
/** Builds the LeadExecutionContent section from the current view. */
export const buildExecutionDraftView = ({
    draft,
    loaded,
    t,
    a,
    agent,
    isWaiting,
    approval,
    decidedAt,
}: BuildExecutionDraftViewContext): { readonly id: string; readonly view: ApprovalCardView } => {
    const statusWord = draft.status === "approved" ? a("approved") : a("rejected")
    const isEditing = isWaiting && approval.isEditing
    return {
        id: draft.id,
        view: {
            nextAction:
                loaded.responsibilities.find((step) => step.id === draft.responsibility_id)?.next_action ??
                t("defaultNextAction"),
            willSend: a("willSend", { lead: loaded.lead.contact_name, channel: loaded.lead.channel }),
            agent,
            status: isWaiting
                ? { label: a("needsApproval"), tone: "warning" }
                : { label: statusWord, tone: draft.status === "approved" ? "success" : "danger" },
            draft: draft.draft,
            characters: a("characters", { count: (isEditing ? approval.editText : draft.draft).length }),
            settledLabel: `${a("decidedBy", { status: statusWord, who: draft.decided_by ?? a("teammate") })}${decidedAt}`,
            isWaiting,
            canDecide: approval.canDecide,
            isEditing,
            editText: approval.editText,
            pendingDecision: isWaiting ? approval.pendingDecision : null,
            error: isWaiting ? approval.error : null,
        },
    }
}
