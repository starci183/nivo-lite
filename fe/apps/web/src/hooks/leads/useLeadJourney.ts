"use client"

import { useQueryLeadJourneySwr } from "@/hooks/swr"
import { loadingSlot, mapSlot, slotOfSwr } from "@/hooks/slot"
import type { LeadJourneyType } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import type { DataSlot, LeadJourney } from "@/modules/types"
import { useTranslations } from "next-intl"
import { channelLabelOf, leadRecordOf } from "./leads.shared"

const journeyOf = (detail: LeadJourneyType): LeadJourney => ({
    lead: leadRecordOf(detail.lead),
    agents: detail.agents,
    responsibilities: detail.responsibilities.map((step) => ({
        id: step.id,
        lead_id: step.leadId,
        title: step.title,
        owner_kind: step.ownerKind === "agent" ? "agent" : "human",
        owner_agent_id: step.ownerAgentId ?? null,
        owner_name: step.ownerName,
        next_action: step.nextAction,
        due_at: step.dueAt ?? null,
        status: step.status === "done" || step.status === "waiting_approval" ? step.status : "open",
        created_at: step.createdAt,
    })),
    executions: detail.executions.map((draft) => ({
        id: draft.id,
        workspace_id: draft.workspaceId,
        responsibility_id: draft.responsibilityId,
        agent_id: draft.agentId ?? null,
        kind: draft.kind,
        draft: draft.draft,
        status: draft.status === "approved" || draft.status === "rejected" ? draft.status : "pending_approval",
        decided_by: draft.decidedBy ?? null,
        decided_at: draft.decidedAt ?? null,
        work_item_id: draft.workItemId ?? null,
        created_at: draft.createdAt,
    })),
    events: detail.events.map((event) => ({
        id: event.id,
        lead_id: event.leadId ?? null,
        kind: event.kind,
        actor: event.actor,
        summary: event.summary,
        evidence: event.evidence ?? null,
        created_at: event.createdAt,
    })),
})

/** The view `useLeadJourney` returns. */
export interface LeadJourneyView extends ReturnType<typeof useQueryLeadJourneySwr> {
    detail: LeadJourney | null
    slot: DataSlot<LeadJourney>
    channelLabel: string
}

/** Reads the lead once through the shared SWR cache and prepares the existing panel view. */
export const useLeadJourney = (leadId: string | undefined): LeadJourneyView => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const query = useQueryLeadJourneySwr(activeWorkspaceId, leadId)
    const t = useTranslations("leads")
    const detail = query.data === undefined ? null : journeyOf(query.data)
    const slot: DataSlot<LeadJourney> = leadId === undefined ? loadingSlot() : mapSlot(slotOfSwr(query), journeyOf)
    const channelLabel = channelLabelOf(detail?.lead.channel ?? "", t)
    return { detail, slot, channelLabel, ...query }
}
