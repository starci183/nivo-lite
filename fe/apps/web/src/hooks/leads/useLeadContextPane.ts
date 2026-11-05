"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { bulletIconOf, toBullets, toSignals } from "@/hooks/leadJourney"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { LeadContextPane, LeadContextView, LeadJourney } from "@/modules/types"
import { useLeadActions } from "./useLeadActions"
import { useLeadJourney } from "./useLeadJourney"

/** The context region of the aside and its commands. */
export interface LeadContextPaneView {
    readonly pane: LeadContextPane
    readonly hasBrief: boolean
    readonly on: { readonly refresh: () => void; readonly copy: () => void }
}

/** The facts of the customer, their own words and the AI brief; refreshing and copying the brief live here. */
export const useLeadContextPane = (leadId: string | undefined): LeadContextPaneView => {
    const t = useTranslations("lead")
    const [error, setError] = useState<string | null>(null)
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const query = useLeadJourney(leadId)
    const actions = useLeadActions()
    const lead = query.detail?.lead ?? null
    const summary = lead?.context_summary ?? null
    const hasBrief = summary !== null && summary.trim().length > 0
    const stamp = (iso: string): string => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" })
    const viewOf = (loaded: LeadJourney): LeadContextView => {
        const bullets = hasBrief ? toBullets(summary) : []
        const preparedAt = [...loaded.events]
            .filter((event) => event.kind === "context.summarised")
            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.created_at
        return {
            contact: [loaded.lead.contact_name, loaded.lead.phone].filter((part) => part !== null).join(" · "),
            company: loaded.lead.company,
            channel: query.channelLabel,
            captured: stamp(loaded.lead.created_at),
            need: loaded.lead.need,
            hasBrief,
            briefLines: bullets.filter((text) => bulletIconOf(text) === "brain"),
            preparedBy: t("preparedBy", { time: stamp(preparedAt ?? loaded.lead.created_at) }),
            signals: toSignals(bullets).map((signal) => ({
                id: signal.id,
                label: `${signal.kind === "urgency" ? t("signalUrgency") : t("signalRisk")}: ${signal.value}`,
            })),
            hasConversation: loaded.events.some((event) => event.kind === "lead.captured" && event.evidence !== null),
        }
    }
    return {
        pane: {
            slot: mapSlot(query.slot, viewOf),
            error: error ?? actions.error,
            isPending: actions.isPending,
            labels: {
                title: t("contextBrief"),
                factContact: t("factContact"),
                factCompany: t("factCompany"),
                factChannel: t("factChannel"),
                factCaptured: t("factCaptured"),
                customerWords: t("customerWords"),
                quoteSource: t("customerWords"),
                viewConversation: t("viewConversation"),
                conversationHref: "#history",
                noBriefTitle: t("noBrief"),
                noBriefHint: t("noBriefHint"),
                prepare: t("prepareContext"),
                errorTitle: t("somethingWrong"),
                slot: slotLabels(t("noBrief")),
            },
        },
        hasBrief,
        on: {
            refresh: () => {
                if (lead === null) return
                setError(null)
                void actions.refreshContext(lead.id)
            },
            copy: () => {
                if (lead === null || !hasBrief) return
                const text = `${lead.contact_name} - ${lead.company}\n${t("copyNeed")}: ${lead.need}\n\n${summary}`
                navigator.clipboard.writeText(text).catch(() => setError(t("copyFailed")))
            },
        },
    }
}
