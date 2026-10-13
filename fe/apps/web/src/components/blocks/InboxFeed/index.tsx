"use client"

import { useFormatter, useTranslations } from "next-intl"
import { bankConnectionOf } from "@/lib/bank"
import { navigation } from "@/modules/i18n"
import { InboxFeedBase } from "./component"
import type { InboxFeedRow } from "./component"

const { useRouter } = navigation

/** One received input as the page hands it over. */
export interface InboxEvent {
    readonly id: string
    readonly channel: string
    readonly kind: string
    readonly origin: string
    readonly status: string
    readonly senderName: string | null
    readonly senderContact: string | null
    readonly body: string
    readonly amountVnd: number | null
    readonly externalRef: string | null
    readonly eventId: string | null
    readonly duplicateCount: number
    readonly leadId: string | null
    readonly createdAt: string
}

/** Props for the connected inbox feed. */
interface InboxFeedProps {
    readonly events: ReadonlyArray<InboxEvent>
    /** The server's clock, so the relative times agree with hydration. */
    readonly nowIso: string
    /** STATE-8: the feed is loading - its heading stays, the rows are three skeleton rows. */
    readonly isLoading?: boolean
}

const toneOf = (status: string): InboxFeedRow["status"]["tone"] =>
    status === "processed"
        ? "success"
        : status === "needs_decision"
          ? "warning"
          : status === "failed"
            ? "danger"
            : "neutral"

/** The connected feed of received inputs: words from the catalogs, relative times and amounts in the active language, a refresh through the router. */
export const InboxFeed = (props: InboxFeedProps) => {
    const t = useTranslations("inbox")
    const g = useTranslations("governance")
    const format = useFormatter()
    const router = useRouter()
    const ago = (iso: string): string => {
        const minutes = Math.max(0, Math.round((new Date(props.nowIso).getTime() - new Date(iso).getTime()) / 60_000))
        if (minutes < 1) return t("justNow")
        if (minutes < 60) return t("minutesAgo", { n: minutes })
        if (minutes < 60 * 24) return t("hoursAgo", { n: Math.floor(minutes / 60) })
        return t("daysAgo", { n: Math.floor(minutes / 1440) })
    }
    const rows = props.events.map((event): InboxFeedRow => {
        const meta = [
            { key: "from", text: t("fromLine", { name: event.senderName ?? t("unnamed") }), strong: false },
            ...(event.senderContact === null ? [] : [{ key: "contact", text: event.senderContact, strong: false }]),
            ...(event.amountVnd === null
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
            ...(event.externalRef === null
                ? []
                : [{ key: "ref", text: t("refLine", { ref: event.externalRef }), strong: false }]),
            ...(event.eventId === null
                ? []
                : [{ key: "event", text: t("eventLine", { id: event.eventId }), strong: false }]),
        ]
        const simulated = event.origin === "simulated"
        return {
            id: event.id,
            source:
                bankConnectionOf({ channel: event.channel, event_id: event.eventId })?.name ??
                g(`channel_${event.channel}`),
            kind: g(`kind_${event.kind}`),
            ago: ago(event.createdAt),
            origin: {
                label: g(simulated ? "origin_simulated" : "origin_live"),
                tone: simulated ? "warning" : "success",
            },
            status: { label: g(`inbound_${event.status}`), tone: toneOf(event.status) },
            body: event.body,
            meta,
            duplicates: event.duplicateCount > 0 ? t("duplicates", { n: event.duplicateCount }) : null,
            lead: event.leadId === null ? null : { href: `/leads/${event.leadId}`, label: t("openLead") },
            office: event.status === "needs_decision" ? { href: "/chat", label: t("openOffice") } : null,
        }
    })
    return (
        <InboxFeedBase
            props={{
                ariaLabel: t("feedAria"),
                title: t("feedTitle"),
                description: t("feedDesc"),
                refreshLabel: t("feedRefresh"),
                emptyTitle: t("feedEmptyTitle"),
                emptyBody: t("feedEmptyBody"),
                isLoading: props.isLoading === true,
                rows,
            }}
            on={{ refresh: () => router.refresh() }}
        />
    )
}
