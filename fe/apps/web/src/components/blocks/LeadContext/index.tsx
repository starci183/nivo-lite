"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useLeadActions, useLeadJourney } from "@/hooks/leads"
import { bulletIconOf, toBullets, toSignals } from "@/hooks/leadJourney"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { LeadJourney, DataSlot } from "@/modules/types"
import { LeadContextBase } from "./component"
import type { ContextView } from "./component"

/** The lead the card describes; null while it loads. */
interface LeadContextProps {
    readonly leadId?: string
}

const COPIED_MS = 2000

/** The customer context card: the refresh of the AI brief and the copy of it live here, the drawing in the pure half. */
export const LeadContext = (props: LeadContextProps) => {
    const t = useTranslations("lead")
    const tc = useTranslations("common")
    const [error, setError] = useState<string | null>(null)
    const [isCopied, setIsCopied] = useState(false)
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const query = useLeadJourney(props.leadId)
    const actions = useLeadActions()
    const isPending = actions.isPending
    const detail = query.detail
    const lead = detail?.lead ?? null
    const summary = lead?.context_summary ?? null
    const hasBrief = summary !== null && summary.trim().length > 0
    const stamp = (iso: string): string => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" })

    useEffect(() => {
        if (!isCopied) return
        const timer = window.setTimeout(() => setIsCopied(false), COPIED_MS)
        return () => window.clearTimeout(timer)
    }, [isCopied])

    const refresh = () => {
        if (lead === null) return
        setError(null)
        void actions.refreshContext(lead.id)
    }
    const copy = () => {
        if (lead === null || !hasBrief) return
        const text = `${lead.contact_name} — ${lead.company}\n${t("copyNeed")}: ${lead.need}\n\n${summary}`
        navigator.clipboard
            .writeText(text)
            .then(() => setIsCopied(true))
            .catch(() => setError(t("copyFailed")))
    }

    const viewOf = (loaded: LeadJourney): ContextView => {
        const bullets = hasBrief ? toBullets(summary) : []
        const preparedAt = [...loaded.events]
            .filter((event) => event.kind === "context.summarised")
            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.created_at
        return {
            contact: loaded.lead.contact_name,
            company: loaded.lead.company,
            channel: query.channelLabel,
            captured: stamp(loaded.lead.created_at),
            need: loaded.lead.need,
            hasBrief,
            briefLines: bullets.map((text, index) => ({ id: `${index}-${text}`, text, icon: bulletIconOf(text) })),
            briefText: summary ?? "",
            signals: toSignals(bullets).map((signal) => ({
                id: signal.id,
                label: `${signal.kind === "urgency" ? t("signalUrgency") : t("signalRisk")}: ${signal.value}`,
            })),
            statusText: t("preparedBy", { time: stamp(preparedAt ?? loaded.lead.created_at) }),
            hasConversation: loaded.events.some((event) => event.kind === "lead.captured" && event.evidence !== null),
        }
    }
    const slot: DataSlot<ContextView> = mapSlot(query.slot, viewOf)

    return (
        <LeadContextBase
            props={{
                slot,
                error: error ?? actions.error,
                isPending,
                labels: {
                    title: t("contextTitle"),
                    factContact: t("factContact"),
                    factCompany: t("factCompany"),
                    factChannel: t("factChannel"),
                    factCaptured: t("factCaptured"),
                    customerWords: t("customerWords"),
                    briefLabel: t("contextBrief"),
                    signalsLabel: t("signals"),
                    aiChip: tc("aiChip"),
                    viewConversation: t("viewConversation"),
                    copy: isCopied ? t("briefCopied") : t("copyBrief"),
                    refresh: t("refreshContext"),
                    noBriefTitle: t("noBrief"),
                    noBriefHint: t("noBriefHint"),
                    prepare: t("prepareContext"),
                    errorTitle: t("somethingWrong"),
                    slot: slotLabels(t("noBrief")),
                },
            }}
            on={{ copy, refresh }}
        />
    )
}
