import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import type { InboxEvent } from "@/components/blocks/InboxFeed"
import { readInboundEvents } from "@/modules/db"
import type { InboundEventRow } from "@/modules/db"
import { InboxPageBase } from "./component"

/** How many received inputs the feed shows. */
const FEED_LIMIT = 40

const toEvent = (row: InboundEventRow): InboxEvent => ({
    id: row.id,
    channel: row.channel,
    kind: row.kind,
    origin: row.origin,
    status: row.status,
    senderName: row.sender_name,
    senderContact: row.sender_contact,
    body: row.body,
    amountVnd: row.amount_vnd,
    externalRef: row.external_ref,
    eventId: row.event_id,
    duplicateCount: row.duplicate_count,
    leadId: row.lead_id,
    createdAt: row.created_at,
})

/** The document title of the page. */
export const inboxMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("inbox")
    return { title: t("title") }
}

/** Inbox ("Đầu vào"): inbound simulator and the feed of everything NIVO received. A failed load reaches error.tsx. */
export const InboxPage = async () => {
    const t = await getTranslations("inbox")
    const events = await readInboundEvents(FEED_LIMIT)
    if (events.kind !== "ok") throw new Error(`inbox: ${events.kind} ${events.code}`)
    return (
        <InboxPageBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: "/dashboard" },
                    { id: "inbox", label: t("title") },
                ],
                eyebrow: t("eyebrow"),
                title: t("title"),
                description: t("description"),
                alertTitle: t("simAlertTitle"),
                alertBody: t("simAlertBody"),
                bankTitle: t("bankTitle"),
                bankSimulated: t("bankSimulated"),
                bankNote: t("bankNote"),
                events: events.value.map(toEvent),
                nowIso: new Date().toISOString(),
                initialEventId: `sim-${crypto.randomUUID().slice(0, 8)}`,
                isLoading: false,
            }}
        />
    )
}
