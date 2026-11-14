import type { MetaEvent } from "@modules/integrations/meta"
import { isRecord } from "@modules/platform/primitives"
import type { MetaSurface, OptionalMetaSurface } from "./meta-inbox.contracts"

/** The kinds a normalised Meta event has. */
const EVENT_KINDS: ReadonlySet<unknown> = new Set(["dm", "comment", "leadgen", "mention", "postback"])

/** The platforms a normalised Meta event comes from. */
const PLATFORMS: ReadonlySet<unknown> = new Set(["facebook", "instagram"])

/** The members of a normalised event that are text or null. */
const NULLABLE_TEXT_MEMBERS = [
    "page_id",
    "ig_id",
    "sender_psid",
    "sender_igsid",
    "sender_name",
    "text",
    "comment_id",
    "post_id",
    "leadgen_id",
    "form_id",
    "ad_id",
    "postback_payload",
    "mid",
] as const

/** The members of a referral, each text or null. */
const REFERRAL_MEMBERS = ["ref", "source", "type", "ad_id"] as const

/** True when the value is text or null. */
const isTextOrNull = (value: unknown): boolean => value === null || typeof value === "string"

/** True when the value is a referral or null. */
const isReferralOrNull = (value: unknown): boolean =>
    value === null || (isRecord(value) && REFERRAL_MEMBERS.every((name) => isTextOrNull(value[name])))

/** True when a stored value has the shape of a normalised Meta event, as the receipt parser wrote it. */
export const isMetaEvent = (value: unknown): value is MetaEvent =>
    isRecord(value) &&
    !Array.isArray(value) &&
    EVENT_KINDS.has(value.kind) &&
    PLATFORMS.has(value.platform) &&
    NULLABLE_TEXT_MEMBERS.every((name) => isTextOrNull(value[name])) &&
    isReferralOrNull(value.referral) &&
    typeof value.timestamp === "number" &&
    Number.isFinite(value.timestamp) &&
    typeof value.event_key === "string" &&
    value.event_key !== ""

/** The Page or Instagram account an event belongs to; null when the event names none. */
export const surfaceOf = (event: MetaEvent): OptionalMetaSurface => {
    const id = event.platform === "facebook" ? event.page_id : event.ig_id
    if (id === null) return null
    return { key: event.platform === "facebook" ? "page_id" : "ig_id", id }
}

/** The one text a surface is told apart by. */
export const surfaceKeyOf = (surface: MetaSurface): string => `${surface.key}:${surface.id}`

/** The distinct surfaces of a delivery's events, in the order they first appear. */
export const distinctSurfacesOf = (events: ReadonlyArray<MetaEvent>): ReadonlyArray<MetaSurface> => {
    const seen = new Map<string, MetaSurface>()
    events.forEach((event) => {
        const surface = surfaceOf(event)
        if (surface !== null && !seen.has(surfaceKeyOf(surface))) seen.set(surfaceKeyOf(surface), surface)
    })
    return [...seen.values()]
}
