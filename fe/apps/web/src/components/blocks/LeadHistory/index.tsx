"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { ageOf } from "@/hooks/leads"
import { eventIconOf, eventKindKeyOf } from "@/hooks/leadJourney"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import type { EventRecord, LeadJourney, DataSlot } from "@/modules/types"
import { LeadHistoryBase } from "./component"
import type { HistoryEntryView, HistoryView } from "./component"

/** The lead whose history is drawn; a null detail draws the loading section. */
interface LeadHistoryProps {
    readonly detail: LeadJourney | null
}

/** The history section: which entries show their evidence lives here, the drawing in the pure half. */
export const LeadHistory = (props: LeadHistoryProps) => {
    const t = useTranslations("lead")
    const slotLabels = useSlotLabels()
    const format = useFormatter()
    const [open, setOpen] = useState<Readonly<Record<string, boolean>>>({})
    const [nowIso] = useState(() => new Date().toISOString())
    const agoText = (iso: string): string => {
        const age = ageOf(iso, nowIso)
        if (age.unit === "now") return t("justNow")
        if (age.unit === "minutes") return t("minAgo", { count: age.n })
        if (age.unit === "hours") return t("hourAgo", { count: age.n })
        if (age.unit === "days") return t("dayAgo", { count: age.n })
        return format.dateTime(new Date(iso), { dateStyle: "medium" })
    }
    const entryOf = (event: EventRecord): HistoryEntryView => {
        const kindKey = eventKindKeyOf(event.kind)
        return {
            id: event.id,
            actor: event.actor,
            dateTime: event.created_at,
            timeLabel: agoText(event.created_at),
            icon: eventIconOf(event.kind),
            kindLabel: kindKey === null ? event.kind : t(kindKey),
            summary: event.summary,
            evidence: event.evidence,
            isOpen: open[event.id] ?? false,
        }
    }
    const viewOf = (detail: LeadJourney): HistoryView => {
        const events = [...detail.events].sort((a, b) => a.created_at.localeCompare(b.created_at))
        return { meta: t("eventsCount", { count: events.length }), entries: events.map(entryOf) }
    }
    const slot: DataSlot<HistoryView> = props.detail === null ? loadingSlot() : { items: viewOf(props.detail) }

    return (
        <LeadHistoryBase
            props={{
                slot,
                labels: {
                    title: t("history"),
                    timelineLabel: t("historyLabel"),
                    emptyTitle: t("noHistory"),
                    emptyHint: t("noHistoryHint"),
                    auditNote: t("auditFooter"),
                    evidenceLabel: t("evidence"),
                    slot: slotLabels(t("noHistory")),
                },
            }}
            on={{ toggle: (entryId, isOpen) => setOpen((previous) => ({ ...previous, [entryId]: isOpen })) }}
        />
    )
}
