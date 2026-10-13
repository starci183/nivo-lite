"use client"

import { useFormatter, useTranslations } from "next-intl"
import { approvalAgentGlyph, useApprovalDecision } from "@/hooks/approval"
import { executionsOf } from "@/hooks/leadJourney"
import { useLeadActions, useLeadJourney } from "@/hooks/leads"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { DataSlot, ExecutionRecord, LeadJourney } from "@/modules/types"
import { LeadExecutionBase } from "./component"
import type { DraftItem, ExecutionView } from "./component"

/** The lead the panel acts on; null while it loads. */
interface LeadExecutionProps {
    readonly leadId?: string
}

/** The execution panel: the owning agent drafts the next message, a person approves, edits or rejects it. */
export const LeadExecution = (props: LeadExecutionProps) => {
    const t = useTranslations("lead")
    const a = useTranslations("approval")
    const common = useTranslations("common")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const query = useLeadJourney(props.leadId)
    const actions = useLeadActions()
    const detail = query.detail
    const { pending, earlier, currentStep } =
        detail === null ? { pending: null, earlier: [], currentStep: null } : executionsOf(detail)
    const approval = useApprovalDecision(pending === null ? null : { id: pending.id, draft: pending.draft })
    const isPending = actions.isPending || approval.isMutating
    const error = actions.error
    const agents = detail?.agents ?? []
    const owner = agents.find((agent) => agent.id === currentStep?.owner_agent_id)
    const actorName = owner?.name ?? "AI"

    const itemOf = (loaded: LeadJourney, draft: ExecutionRecord, isWaiting: boolean): DraftItem => {
        const agentName = agents.find((agent) => agent.id === draft.agent_id)?.name ?? null
        const statusWord = draft.status === "approved" ? a("approved") : a("rejected")
        const decidedAt =
            draft.decided_at === null
                ? ""
                : ` · ${format.dateTime(new Date(draft.decided_at), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" })}`
        const isEditing = isWaiting && approval.isEditing
        return {
            id: draft.id,
            view: {
                nextAction:
                    loaded.responsibilities.find((step) => step.id === draft.responsibility_id)?.next_action ??
                    t("defaultNextAction"),
                willSend: a("willSend", { lead: loaded.lead.contact_name, channel: loaded.lead.channel }),
                agent: agentName === null ? null : { name: agentName, glyph: approvalAgentGlyph() },
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
    const explanationOf = (): string => {
        if (currentStep === null) return t("noOpenNext")
        return owner === undefined ? t("youOwnThis") : t("agentDrafts", { name: owner.name, handle: owner.handle })
    }
    const viewOf = (loaded: LeadJourney): ExecutionView => ({
        explanation: explanationOf(),
        canDraft: currentStep !== null,
        waiting: pending === null ? null : itemOf(loaded, pending, true),
        earlier: earlier.map((draft) => itemOf(loaded, draft, false)),
    })
    const slot: DataSlot<ExecutionView> = mapSlot(query.slot, viewOf)

    const draft = () => {
        if (currentStep === null) return
        void actions.draftExecution(currentStep.id)
    }

    return (
        <LeadExecutionBase
            props={{
                slot,
                error,
                isPending,
                draftingText: actions.isPending ? t("isDrafting", { name: actorName }) : "",
                labels: {
                    cardLabel: t("followUp"),
                    buttonLabel: t("draftWith", { name: actorName }),
                    failTitle: t("draftFailed"),
                    earlierTitle: t("earlierApprovals"),
                    earlierMeta: t("decidedCount", { count: earlier.length }),
                    slot: slotLabels(t("noOpenNext")),
                    approval: {
                        aiChip: common("aiChip"),
                        draft: a("draftLabel"),
                        copy: a("copy"),
                        copied: a("copied"),
                        waitingManager: a("waitingManager"),
                        approveSend: a("approveSend"),
                        edit: a("edit"),
                        discardEdits: a("discardEdits"),
                        reject: a("reject"),
                    },
                },
            }}
            on={{
                draft,
                toggleEdit: approval.toggleEdit,
                editChange: approval.edit,
                decide: approval.decide,
            }}
        />
    )
}
