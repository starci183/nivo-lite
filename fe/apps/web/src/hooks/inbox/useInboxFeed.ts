"use client"

import { useFormatter, useNow, useTranslations } from "next-intl"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { bankConnectionOf } from "@/hooks/banks"
import { CONSOLE_ROUTES, leadHref } from "@/modules/routes"
import { errorMessage } from "./inbox.shared"
import { useQueryInboundEventsSwr } from "@/hooks/swr"

/** The tone each input status wears; a status that is not listed is neutral. */
const STATUS_TONES = {
    processed: "success",
    needs_decision: "warning",
    failed: "danger",
} as const

/** The tone of one input status. */
const toneOf = (status: string): "neutral" | "success" | "warning" | "danger" => {
    if (status === "processed" || status === "needs_decision" || status === "failed") return STATUS_TONES[status]
    return "neutral"
}

/** The inbox feed of the active workspace, every row already in the words of the reader. */
export const useInboxFeed = (isWaiting: boolean) => {
    const t = useTranslations("inbox")
    const g = useTranslations("governance")
    const format = useFormatter()
    const now = useNow({ updateInterval: 60_000 })
    const { activeWorkspaceId } = useActiveWorkspace()
    const { data, error, isLoading, mutate } = useQueryInboundEventsSwr(isWaiting ? undefined : activeWorkspaceId)
    const ago = (iso: string): string => {
        const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000))
        if (minutes < 1) return t("justNow")
        if (minutes < 60) return t("minutesAgo", { n: minutes })
        if (minutes < 60 * 24) return t("hoursAgo", { n: Math.floor(minutes / 60) })
        return t("daysAgo", { n: Math.floor(minutes / 1440) })
    }
    const rows = (data ?? []).map((event) => {
        const meta = [
            { key: "from", text: t("fromLine", { name: event.senderName ?? t("unnamed") }), strong: false },
            ...(event.senderContact == null ? [] : [{ key: "contact", text: event.senderContact, strong: false }]),
            ...(event.amountVnd == null
                ? []
                : [
                      {
                          key: "amount",
                          text: t("amountLine", {
                              amount: format.number(event.amountVnd, {
                                  style: "currency",
                                  currency: "VND",
                                  maximumFractionDigits: 0,
                              }),
                          }),
                          strong: true,
                      },
                  ]),
            ...(event.externalRef == null
                ? []
                : [{ key: "ref", text: t("refLine", { ref: event.externalRef }), strong: false }]),
            ...(event.eventId == null
                ? []
                : [{ key: "event", text: t("eventLine", { id: event.eventId }), strong: false }]),
        ]
        const isSimulated = event.origin === "simulated"
        return {
            id: event.id,
            source:
                bankConnectionOf({ channel: event.channel, event_id: event.eventId })?.name ??
                g(`channel_${event.channel}`),
            kind: g(`kind_${event.kind}`),
            ago: ago(event.createdAt),
            origin: {
                label: g(isSimulated ? "origin_simulated" : "origin_live"),
                tone: isSimulated ? ("warning" as const) : ("success" as const),
            },
            status: { label: g(`inbound_${event.status}`), tone: toneOf(event.status) },
            body: event.body,
            meta,
            duplicates: event.duplicateCount > 0 ? t("duplicates", { n: event.duplicateCount }) : null,
            lead: event.leadId == null ? null : { href: leadHref(event.leadId), label: t("openLead") },
            office: event.status === "needs_decision" ? { href: CONSOLE_ROUTES.chat, label: t("openOffice") } : null,
        }
    })
    return {
        rows,
        isLoading: isWaiting || isLoading,
        error: errorMessage(error, t("loadFailBody")),
        refresh: () => void mutate(),
    }
}
