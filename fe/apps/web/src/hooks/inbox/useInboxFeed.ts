"use client"

import { useFormatter, useNow, useTranslations } from "next-intl"
import { useWorkspaceId } from "@/hooks/workspaces"
import { CONSOLE_ROUTES, leadHref, workspaceHref } from "@/modules/routes"
import { isWaitingOf, mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryInboundEventsSwr } from "@/hooks/swr"
import type { DataSlot, InboxRowView } from "@/modules/types"

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

/**
 * The kinds whose reference is one a person reads out or looks up (a bank transfer's memo, an order or invoice number). For the
 * others the reference is the system's own id of the conversation or the provider's, which says nothing to the owner.
 */
const READABLE_REFERENCE_KINDS: ReadonlySet<string> = new Set(["payment", "order", "invoice"])

/** The pages a row leads to: its customer, and the Office while a decision waits. */
const linksOf = (
    t: ReturnType<typeof useTranslations<"inbox">>,
    workspaceId: string,
    leadId: string | null | undefined,
    status: string,
): Pick<InboxRowView, "lead" | "office"> => ({
    lead: leadId == null ? null : { href: workspaceHref(workspaceId, leadHref(leadId)), label: t("openLead") },
    office:
        status === "needs_decision"
            ? { href: workspaceHref(workspaceId, CONSOLE_ROUTES.chat), label: t("openOffice") }
            : null,
})

/** The view `useInboxFeed` returns. */
export interface InboxFeedView {
    slot: DataSlot<InboxRowView[]>
    /** The first read has no data yet: the panes draw their skeletons. */
    isWaiting: boolean
    refresh: () => undefined
}

/** The inbox feed of the active workspace, every row already in the words of the reader. */
export const useInboxFeed = (): InboxFeedView => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("inbox")
    const g = useTranslations("governance")
    const format = useFormatter()
    const now = useNow({ updateInterval: 60_000 })
    const swrRead = useQueryInboundEventsSwr(workspaceId)
    const { mutate } = swrRead
    const minutesSince = (iso: string): number =>
        Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000))
    const ago = (iso: string): string => {
        const minutes = minutesSince(iso)
        if (minutes < 1) return t("justNow")
        if (minutes < 60) return t("minutesAgo", { n: minutes })
        if (minutes < 60 * 24) return t("hoursAgo", { n: Math.floor(minutes / 60) })
        return t("daysAgo", { n: Math.floor(minutes / 1440) })
    }
    const agoShort = (iso: string): string => {
        const minutes = minutesSince(iso)
        if (minutes < 1) return t("justNow")
        if (minutes < 60) return t("minutesShort", { n: minutes })
        if (minutes < 60 * 24) return t("hoursShort", { n: Math.floor(minutes / 60) })
        return t("daysShort", { n: Math.floor(minutes / 1440) })
    }
    const rowOf = (event: NonNullable<typeof swrRead.data>[number]): InboxRowView => {
        const sender = event.senderName ?? t("unnamed")
        const amount =
            event.amountVnd == null
                ? null
                : format.number(event.amountVnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
        const reference =
            event.externalRef == null || !READABLE_REFERENCE_KINDS.has(event.kind) ? null : event.externalRef
        const source = g(`channel_${event.channel}`)
        const kind = g(`kind_${event.kind}`)
        const details = [
            { key: "from", term: t("termFrom"), text: sender },
            ...(event.senderContact == null
                ? []
                : [{ key: "contact", term: t("termContact"), text: event.senderContact }]),
            { key: "channel", term: t("termChannel"), text: source },
            { key: "kind", term: t("termKind"), text: kind },
            {
                key: "received",
                term: t("termReceived"),
                text: format.dateTime(new Date(event.createdAt), { dateStyle: "short", timeStyle: "short" }),
            },
            ...(amount === null ? [] : [{ key: "amount", term: t("termAmount"), text: amount }]),
            ...(reference === null ? [] : [{ key: "ref", term: t("termRef"), text: reference }]),
        ]
        const line =
            event.body === ""
                ? [kind, amount, reference === null ? null : t("refLine", { ref: reference })]
                : [source, kind, t("quoted", { text: event.body })]
        return {
            id: event.id,
            title: t("detailTitle", { kind, name: sender }),
            sender,
            source,
            kind,
            channelKey: event.channel,
            kindKey: event.kind,
            ago: ago(event.createdAt),
            agoShort: agoShort(event.createdAt),
            status: { label: g(`inbound_${event.status}`), tone: toneOf(event.status) },
            body: event.body,
            line: line.filter((part) => part !== null).join(" · "),
            details,
            duplicates: event.duplicateCount,
            ...linksOf(t, workspaceId, event.leadId, event.status),
        }
    }
    const slot = mapSlot(slotOfSwr(swrRead), (events) => events.map(rowOf))
    return {
        slot,
        isWaiting: isWaitingOf(slot),
        refresh: () => void mutate(),
    }
}
