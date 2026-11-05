"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { actionWordOf } from "@/hooks/actionWord"
import { eventIconOf, eventKindKeyOf } from "@/hooks/leadJourney"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type {
    EventRecord,
    LeadJourney,
    LeadTimelineEntryView,
    LeadTimelinePane,
    LeadTimelineView,
} from "@/modules/types"
import { ageOf, splitResponsibilities, STATUS_KEYS } from "./leads.shared"
import { useLeadJourney } from "./useLeadJourney"

/** The event whose summary is the action key of the command it sent. */
const COMMAND_SENT = "command.sent"

/** The activity trail region: its read, its words and the open evidence rows. */
export interface LeadTimelinePaneView {
    readonly pane: LeadTimelinePane
    readonly on: {
        readonly retry: () => void
        readonly toggle: (entryId: string, isOpen: boolean) => void
    }
}

/** One timeline: the events of the lead and its earlier steps, oldest first, each as "who · when", what, and the evidence behind it. */
export const useLeadTimelinePane = (leadId: string | undefined): LeadTimelinePaneView => {
    const query = useLeadJourney(leadId)
    const t = useTranslations("lead")
    const g = useTranslations("governance")
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
    const eventOf = (event: EventRecord): LeadTimelineEntryView => ({
        id: event.id,
        dateTime: event.created_at,
        timeLabel: `${event.actor} · ${agoText(event.created_at)}`,
        icon: eventIconOf(event.kind),
        title: t(eventKindKeyOf(event.kind)),
        summary: event.kind === COMMAND_SENT ? actionWordOf(g, event.summary) : event.summary,
        evidence: event.evidence,
        isOpen: open[event.id] ?? false,
    })
    const viewOf = (detail: LeadJourney): LeadTimelineView => {
        const steps = splitResponsibilities(detail.responsibilities).previous.map((step): LeadTimelineEntryView => ({
            id: step.id,
            dateTime: step.created_at,
            timeLabel: `${step.owner_name} · ${agoText(step.created_at)}`,
            icon: "pending",
            title: step.title,
            summary: t(STATUS_KEYS[step.status]),
            evidence: null,
            isOpen: false,
        }))
        const entries = [...detail.events.map(eventOf), ...steps].sort((a, b) => a.dateTime.localeCompare(b.dateTime))
        return { meta: t("eventsCount", { count: entries.length }), entries }
    }
    return {
        pane: {
            slot: mapSlot(query.slot, viewOf),
            labels: {
                title: t("history"),
                timelineLabel: t("historyLabel"),
                emptyHint: t("noHistoryHint"),
                auditNote: t("auditFooter"),
                evidenceLabel: t("evidence"),
                slot: slotLabels(t("noHistory")),
            },
        },
        on: {
            retry: () => void query.mutate(),
            toggle: (entryId, isOpen) => setOpen((previous) => ({ ...previous, [entryId]: isOpen })),
        },
    }
}
