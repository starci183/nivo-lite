"use client"

import { useFormatter, useTranslations } from "next-intl"
import { approvalAgentGlyph, useApprovalDecision } from "@/hooks/approval"
import { useDraftDecision } from "./useDraftDecision"
import { useAgentPictures } from "@/hooks/installations"
import { executionsOf } from "@/hooks/leadJourney"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type {
    DataSlot,
    ExecutionRecord,
    LeadApprovalPane,
    LeadApprovalView,
    LeadDraftItem,
    LeadJourney,
} from "@/modules/types"
import { useLeadActions } from "./useLeadActions"
import { useLeadJourney } from "./useLeadJourney"

/** The approval region of one lead and the commands on its draft. */
export interface LeadApprovalPaneView {
    readonly pane: LeadApprovalPane
    readonly on: {
        readonly toggleEdit: () => void
        readonly editChange: (value: string) => void
        readonly decide: (decision: "approved" | "rejected") => void
    }
}

/** The words of the approval region. */
const useApprovalLabels = (earlierCount: number): LeadApprovalPane["labels"] => {
    const t = useTranslations("lead")
    const a = useTranslations("approval")
    const slotLabels = useSlotLabels()
    return {
        waitingTitle: t("waitingTitle"),
        followUp: t("followUp"),
        failTitle: t("draftFailed"),
        earlierTitle: t("earlierApprovals"),
        earlierMeta: t("decidedCount", { count: earlierCount }),
        slot: slotLabels(t("noOpenNext")),
        approval: {
            note: a("note"),
            draft: a("draftLabel"),
            copy: a("copy"),
            copied: a("copied"),
            waitingManager: a("waitingManager"),
            approveSend: a("approveSend"),
            edit: a("edit"),
            discardEdits: a("discardEdits"),
            reject: a("reject"),
        },
    }
}

/** The owning agent drafts the next message; a person approves, edits or rejects it. Words and state of that region. */
export const useLeadApprovalPane = (leadId: string | undefined): LeadApprovalPaneView => {
    const t = useTranslations("lead")
    const a = useTranslations("approval")
    const format = useFormatter()
    const query = useLeadJourney(leadId)
    const actions = useLeadActions()
    const pictureOf = useAgentPictures()
    const detail = query.detail
    const { pending, earlier, currentStep } =
        detail === null ? { pending: null, earlier: [], currentStep: null } : executionsOf(detail)
    const labels = useApprovalLabels(earlier.length)
    const drafts = useDraftDecision()
    const approval = useApprovalDecision(pending === null ? null : { id: pending.id, draft: pending.draft }, drafts)
    const agents = detail?.agents ?? []
    const owner = agents.find((agent) => agent.id === currentStep?.owner_agent_id)

    const itemOf = (loaded: LeadJourney, draft: ExecutionRecord, isWaiting: boolean): LeadDraftItem => {
        const drafter = agents.find((agent) => agent.id === draft.agent_id)
        const statusWord = draft.status === "approved" ? a("approved") : a("rejected")
        const isEditing = isWaiting && approval.isEditing
        const decidedAt =
            draft.decided_at === null
                ? ""
                : ` · ${format.dateTime(new Date(draft.decided_at), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" })}`
        return {
            id: draft.id,
            view: {
                nextAction:
                    loaded.responsibilities.find((step) => step.id === draft.responsibility_id)?.next_action ??
                    t("defaultNextAction"),
                willSend: a("willSend", { lead: loaded.lead.contact_name, channel: query.channelLabel }),
                agent:
                    drafter === undefined
                        ? null
                        : { name: drafter.name, glyph: approvalAgentGlyph(), avatarUrl: pictureOf(drafter) },
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
    const explanation = (): string => {
        if (currentStep === null) return t("noOpenNext")
        return owner === undefined ? t("youOwnThis") : t("agentDrafts", { name: owner.name, handle: owner.handle })
    }
    const viewOf = (loaded: LeadJourney): LeadApprovalView => ({
        explanation: explanation(),
        canDraft: currentStep !== null,
        waiting: pending === null ? null : itemOf(loaded, pending, true),
        earlier: earlier.map((draft) => itemOf(loaded, draft, false)),
    })
    const slot: DataSlot<LeadApprovalView> = mapSlot(query.slot, viewOf)
    return {
        pane: {
            slot,
            labels,
            error: actions.error,
            isPending: actions.isPending || approval.isMutating,
        },
        on: { toggleEdit: approval.toggleEdit, editChange: approval.edit, decide: approval.decide },
    }
}
