"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { executionsOf } from "@/hooks/leadJourney"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { writeDraftExecution } from "@/modules/db/leads/write-lead-actions"
import type { ExecutionRecord, LeadJourney, DataSlot } from "@/modules/types"
import { LeadExecutionBase } from "./component"
import type { DraftItem, ExecutionView } from "./component"

/** The lead the panel acts on; null while it loads. */
interface LeadExecutionProps {
    readonly detail: LeadJourney | null
}

/** The execution panel: the owning agent drafts the next message, a person approves, edits or rejects it. */
export const LeadExecution = (props: LeadExecutionProps) => {
    const t = useTranslations("lead")
    const slotLabels = useSlotLabels()
    const router = navigation.useRouter()
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const detail = props.detail
    const { pending, earlier, currentStep } =
        detail === null ? { pending: null, earlier: [], currentStep: null } : executionsOf(detail)
    const agents = detail?.agents ?? []
    const owner = agents.find((agent) => agent.id === currentStep?.owner_agent_id)
    const actorName = owner?.name ?? "AI"

    const itemOf = (loaded: LeadJourney, draft: ExecutionRecord): DraftItem => ({
        id: draft.id,
        execution: draft,
        leadName: loaded.lead.contact_name,
        channel: loaded.lead.channel,
        agentName: agents.find((agent) => agent.id === draft.agent_id)?.name ?? null,
        nextAction:
            loaded.responsibilities.find((step) => step.id === draft.responsibility_id)?.next_action ??
            t("defaultNextAction"),
    })
    const explanationOf = (): string => {
        if (currentStep === null) return t("noOpenNext")
        return owner === undefined ? t("youOwnThis") : t("agentDrafts", { name: owner.name, handle: owner.handle })
    }
    const viewOf = (loaded: LeadJourney): ExecutionView => ({
        explanation: explanationOf(),
        canDraft: currentStep !== null,
        waiting: pending === null ? null : itemOf(loaded, pending),
        earlier: earlier.map((draft) => itemOf(loaded, draft)),
    })
    const slot: DataSlot<ExecutionView> = detail === null ? loadingSlot() : { items: viewOf(detail) }

    const draft = () => {
        if (currentStep === null) return
        setError(null)
        startTransition(async () => {
            const result = await writeDraftExecution(currentStep.id)
            if (result.kind === "ok") router.refresh()
            else setError(result.kind === "unavailable" ? result.code : t("draftFailed"))
        })
    }

    return (
        <LeadExecutionBase
            props={{
                slot,
                error,
                isPending,
                draftingText: isPending ? t("isDrafting", { name: actorName }) : "",
                labels: {
                    cardLabel: t("followUp"),
                    buttonLabel: t("draftWith", { name: actorName }),
                    failTitle: t("draftFailed"),
                    earlierTitle: t("earlierApprovals"),
                    earlierMeta: t("decidedCount", { count: earlier.length }),
                    slot: slotLabels(t("noOpenNext")),
                },
            }}
            on={{ draft }}
        />
    )
}
