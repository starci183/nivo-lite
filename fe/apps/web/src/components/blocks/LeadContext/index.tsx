"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useState, useTransition } from "react"
import { bulletIconOf, toBullets, toSignals } from "@/hooks/leadJourney"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { writeRefreshContext } from "@/modules/db/leads/write-lead-actions"
import type { LeadJourney, DataSlot } from "@/modules/types"
import { LeadContextBase } from "./component"
import type { ContextView } from "./component"

/** The lead the card describes; null while it loads. */
interface LeadContextProps {
    readonly detail: LeadJourney | null
    /** The label of the channel the lead came through, already translated when it is a known one. */
    readonly channelLabel: string
}

const COPIED_MS = 2000

/** The customer context card: the refresh of the AI brief and the copy of it live here, the drawing in the pure half. */
export const LeadContext = (props: LeadContextProps) => {
    const t = useTranslations("lead")
    const tc = useTranslations("common")
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const router = navigation.useRouter()
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [isCopied, setIsCopied] = useState(false)
    const detail = props.detail
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
        startTransition(async () => {
            const result = await writeRefreshContext(lead.id)
            if (result.kind === "ok") router.refresh()
            else setError(result.kind === "unavailable" ? result.code : t("somethingWrong"))
        })
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
            channel: props.channelLabel,
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
    const slot: DataSlot<ContextView> = detail === null ? loadingSlot() : { items: viewOf(detail) }

    return (
        <LeadContextBase
            props={{
                slot,
                error,
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
