"use client"

import { useFormatter, useTranslations } from "next-intl"
import { approvalAgentGlyph, useApprovalDecision } from "@/hooks/approval"
import { executionsOf } from "@/hooks/leadJourney"
import { useAgentPictures } from "@/hooks/installations"
import { useLeadActions, useLeadJourney } from "@/hooks/leads"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { DataSlot, ExecutionRecord, LeadJourney } from "@/modules/types"
import { LeadExecutionBase } from "./component"
import type { DraftItem, ExecutionView } from "./component"
import { buildExecutionDraftView } from "./draftView"

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
    const pictureOf = useAgentPictures()
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
        const drafter = agents.find((agent) => agent.id === draft.agent_id)
        const agent =
            drafter === undefined
                ? null
                : { name: drafter.name, glyph: approvalAgentGlyph(), avatarUrl: pictureOf(drafter) }
        const decidedAt =
            draft.decided_at === null
                ? ""
                : ` · ${format.dateTime(new Date(draft.decided_at), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" })}`
        return buildExecutionDraftView({
            draft,
            loaded,
            t,
            a,
            agent,
            isWaiting,
            approval,
            decidedAt,
        })
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
            props={buildExecutionPanelView({
                slot,
                error,
                isPending,
                actions,
                t,
                actorName,
                earlier,
                slotLabels,
                common,
                a,
            })}
            on={{
                draft,
                toggleEdit: approval.toggleEdit,
                editChange: approval.edit,
                decide: approval.decide,
            }}
        />
    )
}

/** Inputs needed to build the LeadExecutionContent section. */
interface BuildExecutionPanelViewContext {
    readonly slot: DataSlot<ExecutionView>
    readonly error: string | null
    readonly isPending: boolean
    readonly actions: ReturnType<typeof useLeadActions>
    readonly t: ReturnType<typeof useTranslations<"lead">>
    readonly actorName: string
    readonly earlier: readonly ExecutionRecord[]
    readonly slotLabels: ReturnType<typeof useSlotLabels>
    readonly common: ReturnType<typeof useTranslations<"common">>
    readonly a: ReturnType<typeof useTranslations<"approval">>
}
/** Builds the LeadExecutionContent section from the current view. */
const buildExecutionPanelView = ({
    slot,
    error,
    isPending,
    actions,
    t,
    actorName,
    earlier,
    slotLabels,
    common,
    a,
}: BuildExecutionPanelViewContext) =>
    ({
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
    }) as const
