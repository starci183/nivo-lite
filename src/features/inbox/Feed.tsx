"use client"

import { useRouter } from "next/navigation"
import { Badge, Button, EmptyNotice, SectionHeader, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { inbox as dict } from "@/i18n/dict/inbox"
import { governance } from "@/i18n/dict/governance"
import { FEED_BADGES_CLASS, FEED_FOOT_CLASS, FEED_HEAD_CLASS, FEED_HEADER_CLASS, FEED_ITEM_CLASS, FEED_LIST_CLASS, FEED_META_CLASS, FEED_TITLE_CLASS } from "./classNames"
import { formatVnd, type FeedEvent } from "./model"
import { bankConnectionOf } from "@/lib/bank"

/** Props for {@link Feed}. */
export type FeedProps = { readonly events: ReadonlyArray<FeedEvent>; readonly nowIso: string }

const STATUS_TONE = { received: "neutral", processed: "success", needs_decision: "warning", failed: "danger" } as const

/** Feed of received inputs, newest first. Every row says whether it is live or simulated. */
export const Feed = ({ events, nowIso }: FeedProps) => {
  const router = useRouter()
  const t = useT(dict)
  const g = useT(governance)
  const locale = useLocale()

  const ago = (iso: string): string => {
    const minutes = Math.max(0, Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 60_000))
    if (minutes < 1) return t("justNow")
    if (minutes < 60) return t("minutesAgo", { n: minutes })
    if (minutes < 60 * 24) return t("hoursAgo", { n: Math.floor(minutes / 60) })
    return t("daysAgo", { n: Math.floor(minutes / 1440) })
  }

  return (
    <SurfaceCard ariaLabel={t("feedAria")}>
      <div className={FEED_HEADER_CLASS}>
        <SectionHeader level={2} title={t("feedTitle")} description={t("feedDesc")} />
        <Button variant="secondary" onPress={() => router.refresh()}>{t("feedRefresh")}</Button>
      </div>
      {events.length === 0 ? (
        <EmptyNotice message={t("feedEmptyTitle")} description={t("feedEmptyBody")} />
      ) : (
        <ul className={FEED_LIST_CLASS}>
          {events.map((e) => (
            <li key={e.id} className={FEED_ITEM_CLASS}>
              <div className={FEED_HEAD_CLASS}>
                <div className={FEED_TITLE_CLASS}>
                  <Text weight="semibold">{bankConnectionOf(e)?.name ?? g(`channel_${e.channel}`)}</Text>
                  <Text tone="muted" size="sm">{g(`kind_${e.kind}`)}</Text>
                  <Text tone="muted" size="sm">{ago(e.created_at)}</Text>
                </div>
                <div className={FEED_BADGES_CLASS}>
                  <Badge tone={e.origin === "simulated" ? "warning" : "success"}>{g(e.origin === "simulated" ? "origin_simulated" : "origin_live")}</Badge>
                  <Badge tone={STATUS_TONE[e.status]}>{g(`inbound_${e.status}`)}</Badge>
                </div>
              </div>
              {e.body ? <Text overflow="clamp-2">{e.body}</Text> : null}
              <div className={FEED_META_CLASS}>
                <Text size="sm" tone="muted">{t("fromLine", { name: e.sender_name ?? t("unnamed") })}</Text>
                {e.sender_contact ? <Text size="sm" tone="muted">{e.sender_contact}</Text> : null}
                {e.amount_vnd !== null ? <Text size="sm" weight="medium">{t("amountLine", { amount: formatVnd(e.amount_vnd, locale) })}</Text> : null}
                {e.external_ref ? <Text size="sm" tone="muted">{t("refLine", { ref: e.external_ref })}</Text> : null}
                {e.event_id ? <Text size="sm" tone="muted">{t("eventLine", { id: e.event_id })}</Text> : null}
              </div>
              {e.duplicate_count > 0 || e.lead_id || e.status === "needs_decision" ? (
                <div className={FEED_FOOT_CLASS}>
                  {e.duplicate_count > 0 ? <Text size="sm" tone="muted">{t("duplicates", { n: e.duplicate_count })}</Text> : null}
                  {e.lead_id ? <TextAction href={`/leads/${e.lead_id}`}>{t("openLead")}</TextAction> : null}
                  {e.status === "needs_decision" ? <TextAction href="/chat">{t("openOffice")}</TextAction> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SurfaceCard>
  )
}
