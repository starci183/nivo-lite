import type { IconName } from "@/ui"
import type { LeadStage } from "@/lib/types"
import { intlLocale, TIME_ZONE, type Locale, type Translate } from "@/i18n/core"
import type { leads } from "@/i18n/dict/leads"

/** Translator of the leads dictionary. */
export type LeadsT = Translate<(typeof leads)["en"]>

/** Badge tone allowed by Grammar. */
export type StageTone = "neutral" | "accent" | "success" | "warning" | "danger"

/** Display label and tone for each lead stage. */
export const STAGE_VIEW: Readonly<Record<LeadStage, { readonly key: "stageNew" | "stageQualified" | "stageProposal" | "stageWon" | "stageLost"; readonly tone: StageTone }>> = {
  new: { key: "stageNew", tone: "neutral" },
  qualified: { key: "stageQualified", tone: "accent" },
  proposal: { key: "stageProposal", tone: "warning" },
  won: { key: "stageWon", tone: "success" },
  lost: { key: "stageLost", tone: "danger" },
}

/** Stage order used for the tabs and the "Stage" sort. */
export const STAGE_ORDER: ReadonlyArray<LeadStage> = ["new", "qualified", "proposal", "won", "lost"]

type ChannelKey = "channelZalo" | "channelWebsiteChat" | "channelWebsiteForm" | "channelPhone" | "channelEmail" | "channelReferral"

/** Channel choices for the new-lead form, in display order. */
export const CHANNEL_KEYS: ReadonlyArray<ChannelKey> = ["channelZalo", "channelWebsiteChat", "channelWebsiteForm", "channelPhone", "channelEmail", "channelReferral"]

/** Stored channel values (English or Vietnamese seed/user data) mapped to a channel key. */
const CHANNEL_ALIASES: Readonly<Record<string, ChannelKey>> = {
  zalo: "channelZalo",
  "website chat": "channelWebsiteChat",
  "chat website": "channelWebsiteChat",
  "chat trên website": "channelWebsiteChat",
  "website form": "channelWebsiteForm",
  "form website": "channelWebsiteForm",
  "biểu mẫu website": "channelWebsiteForm",
  phone: "channelPhone",
  "điện thoại": "channelPhone",
  email: "channelEmail",
  referral: "channelReferral",
  "giới thiệu": "channelReferral",
}

/** Channel key of a stored channel value, or null when it is free text. */
export const channelKeyOf = (channel: string): ChannelKey | null => CHANNEL_ALIASES[channel.trim().toLowerCase().normalize("NFC")] ?? null

/** Translated channel label; unknown stored values are shown as stored. */
export const channelLabel = (t: LeadsT, channel: string): string => {
  const key = channelKeyOf(channel)
  return key ? t(key) : channel
}

const CHANNEL_ICONS: Readonly<Record<ChannelKey, IconName>> = {
  channelZalo: "send",
  channelWebsiteChat: "support",
  channelWebsiteForm: "blog",
  channelPhone: "notification",
  channelEmail: "email",
  channelReferral: "community",
}

/** Neutral tile glyph for a channel (either language); falls back to a generic contact glyph. */
export const channelIcon = (channel: string): IconName => {
  const key = channelKeyOf(channel)
  return key ? CHANNEL_ICONS[key] : /website/i.test(channel) ? "support" : "account"
}

/** Deterministic captured-at label (Vietnam time) so server and client render the same text. */
export const formatCaptured = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso))

/** "10:00, 29 Sep" style freshness label (Vietnam time, deterministic). */
export const formatFresh = (iso: string, locale: Locale): string => {
  const parts = new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", timeZone: TIME_ZONE, hourCycle: "h23" }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return `${get("hour")}:${get("minute")}, ${get("day")} ${get("month")}`
}

/** Relative "3 h ago" label against a server-supplied now, so hydration matches. */
export const timeAgo = (iso: string, nowIso: string, t: LeadsT, locale: Locale): string => {
  const minutes = Math.max(0, Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return t("agoJustNow")
  if (minutes < 60) return t("agoMinutes", { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t("agoHours", { n: hours })
  const days = Math.floor(hours / 24)
  return days < 30 ? t("agoDays", { n: days }) : formatCaptured(iso, locale)
}
