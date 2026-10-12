import { intlLocale, type Locale } from "@/i18n/core"
import type { InboundEvent, InboundKind, SimulateInboundInput } from "@/lib/flow-types"

/** Channels the simulator can send from (website chat is real and lives in the Chatbot). */
export const CHANNELS: ReadonlyArray<SimulateInboundInput["channel"]> = ["zalo", "facebook", "email", "phone", "bank", "manual"]

/** Kinds the simulator can send. */
export const KINDS: ReadonlyArray<Extract<InboundKind, "message" | "order" | "payment">> = ["message", "order", "payment"]

/** An inbound row as stored: `event_id` is the channel's own event id (the idempotency key), when it has one. */
export type FeedEvent = InboundEvent & { readonly event_id?: string | null }

/** A simulator submission: the simulated input plus its channel event id ("Mã sự kiện"). */
export type SimulatorInput = SimulateInboundInput & { readonly event_id?: string }

/** A fresh simulator event id. The same id sent again is a duplicate; a new id is a new input even with identical text. */
export const newEventId = (): string => `sim-${crypto.randomUUID().slice(0, 8)}`

/** Simulator channel type. */
export type SimChannel = SimulateInboundInput["channel"]

/** Simulator kind type. */
export type SimKind = (typeof KINDS)[number]

/** VND amount with grouping in the active locale, e.g. "45.000.000 ₫". */
export const formatVnd = (n: number, locale: Locale): string =>
  new Intl.NumberFormat(intlLocale(locale) === "vi-VN" ? "vi-VN" : "en-GB", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n)
