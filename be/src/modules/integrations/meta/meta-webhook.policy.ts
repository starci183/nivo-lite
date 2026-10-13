import { createHmac, timingSafeEqual } from "node:crypto"
import type { MetaEvent, MetaEventKind, MetaLead, MetaPlatform, MetaReferral } from "./meta.contracts"

/** Constant-time equality of two strings (different lengths are simply unequal). */
export const safeEqual = (a: string, b: string): boolean => {
    const x = Buffer.from(a)
    const y = Buffer.from(b)
    return x.length === y.length && timingSafeEqual(x, y)
}

/** `X-Hub-Signature-256: sha256=<hex>` is the HMAC-SHA256 of the RAW request body with the app secret. Constant-time compare. */
export const verifySignature = (
    header: string | null | undefined,
    rawBody: Buffer | string,
    appSecret: string,
): boolean => {
    if (!header || !appSecret) return false
    const matched = /^sha256=([0-9a-f]{64})$/iu.exec(header.trim())
    if (!matched?.[1]) return false
    const expected = createHmac("sha256", appSecret).update(rawBody).digest()
    return timingSafeEqual(Buffer.from(matched[1], "hex"), expected)
}

/** What a webhook verification request carries. */
export interface HubQuery {
    /** `hub.mode`. */
    readonly mode: string | undefined
    /** `hub.verify_token`. */
    readonly verifyToken: string | undefined
    /** `hub.challenge`. */
    readonly challenge: string | undefined
}

/** GET verification: `hub.mode=subscribe` and a `hub.verify_token` equal to ours gives back `hub.challenge`, else null. */
export const verifyChallenge = (query: HubQuery, verifyToken: string | undefined): string | null => {
    const token = (verifyToken ?? "").trim()
    if (!token || query.challenge === undefined || query.mode !== "subscribe") return null
    return safeEqual(query.verifyToken ?? "", token) ? query.challenge : null
}

type Obj = Record<string, unknown>

const isObj = (value: unknown): value is Obj => typeof value === "object" && value !== null && !Array.isArray(value)
const obj = (value: unknown): Obj | null => (isObj(value) ? value : null)
const arr = (value: unknown): Array<unknown> => (Array.isArray(value) ? value : [])
const str = (value: unknown): string | null => {
    if (typeof value === "string" && value !== "") return value
    return typeof value === "number" ? String(value) : null
}
const num = (value: unknown): number | null => {
    if (typeof value === "number") return value
    return typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : null
}
/** Meta sends seconds in `time`/`created_time` and milliseconds in messaging `timestamp`. */
const ms = (value: number | null, unit: "s" | "ms"): number | null => {
    if (value === null) return null
    return unit === "s" ? value * 1000 : value
}

const referralOf = (value: unknown): MetaReferral | null => {
    const referral = obj(value)
    if (!referral) return null
    const ads = obj(referral.ads_context_data)
    const out: MetaReferral = {
        ref: str(referral.ref),
        source: str(referral.source),
        type: str(referral.type),
        ad_id: str(referral.ad_id) ?? str(ads?.ad_id),
    }
    return out.ref || out.source || out.type || out.ad_id ? out : null
}

const blank = (platform: MetaPlatform, kind: MetaEventKind, timestamp: number, eventKey: string): MetaEvent => ({
    kind,
    platform,
    page_id: null,
    ig_id: null,
    sender_psid: null,
    sender_igsid: null,
    sender_name: null,
    text: null,
    comment_id: null,
    post_id: null,
    leadgen_id: null,
    form_id: null,
    ad_id: null,
    referral: null,
    postback_payload: null,
    mid: null,
    timestamp,
    event_key: eventKey,
})

const idsFor = (platform: MetaPlatform, entryId: string | null) =>
    platform === "facebook" ? { page_id: entryId, ig_id: null } : { page_id: null, ig_id: entryId }

const senderFor = (platform: MetaPlatform, id: string | null) =>
    platform === "facebook" ? { sender_psid: id, sender_igsid: null } : { sender_psid: null, sender_igsid: id }

/** One `messaging` item (also the value of a `messages` / `messaging_postbacks` change): a DM or a postback, never an echo, receipt or reaction. */
const fromMessaging = (
    platform: MetaPlatform,
    entryId: string | null,
    item: unknown,
    fallbackTime: number,
): MetaEvent | null => {
    const messaging = obj(item)
    if (!messaging) return null
    const senderId = str(obj(messaging.sender)?.id)
    if (!senderId || senderId === entryId) return null
    const when = ms(num(messaging.timestamp), "ms") ?? fallbackTime
    const message = obj(messaging.message)
    const postback = obj(messaging.postback)
    if (message?.is_echo === true) return null
    if (postback) {
        const mid = str(postback.mid)
        const payload = str(postback.payload)
        const title = str(postback.title)
        return {
            ...blank(platform, "postback", when, `postback:${mid ?? `${senderId}:${when}:${payload ?? title ?? ""}`}`),
            ...idsFor(platform, entryId),
            ...senderFor(platform, senderId),
            text: title ?? payload,
            postback_payload: payload,
            mid,
            referral: referralOf(postback.referral) ?? referralOf(messaging.referral),
        }
    }
    if (message) {
        const mid = str(message.mid)
        const quick = str(obj(message.quick_reply)?.payload)
        const hasAttachment = arr(message.attachments).length > 0
        const text = str(message.text)
        if (!text && !hasAttachment && !quick) return null
        return {
            ...blank(platform, "dm", when, `dm:${mid ?? `${senderId}:${when}`}`),
            ...idsFor(platform, entryId),
            ...senderFor(platform, senderId),
            text: text ?? quick,
            mid,
            postback_payload: quick,
            referral: referralOf(message.referral) ?? referralOf(messaging.referral),
        }
    }
    return null
}

const fromFacebookChange = (entryId: string | null, field: string, value: Obj, time: number): MetaEvent | null => {
    if (field === "leadgen") {
        const leadgenId = str(value.leadgen_id)
        if (!leadgenId) return null
        return {
            ...blank("facebook", "leadgen", ms(num(value.created_time), "s") ?? time, `leadgen:${leadgenId}`),
            page_id: str(value.page_id) ?? entryId,
            leadgen_id: leadgenId,
            form_id: str(value.form_id),
            ad_id: str(value.ad_id),
        }
    }
    if (field === "feed" || field === "mention") {
        const item = str(value.item)
        const verb = str(value.verb)
        const from = obj(value.from)
        const fromId = str(from?.id)
        if (fromId && fromId === entryId) return null
        if (field === "feed" && !(item === "comment" && verb === "add")) return null
        if (field === "mention" && verb !== null && verb !== "add") return null
        const commentId = str(value.comment_id)
        const postId = str(value.post_id)
        const key = field === "mention" ? `mention:${commentId ?? postId ?? ""}` : `comment:${commentId ?? ""}`
        if (key.endsWith(":")) return null
        return {
            ...blank(
                "facebook",
                field === "mention" ? "mention" : "comment",
                ms(num(value.created_time), "s") ?? time,
                key,
            ),
            page_id: entryId,
            ...senderFor("facebook", fromId),
            sender_name: str(from?.name),
            text: str(value.message),
            comment_id: commentId,
            post_id: postId,
        }
    }
    return null
}

const fromInstagramChange = (entryId: string | null, field: string, value: Obj, time: number): MetaEvent | null => {
    if (field === "comments") {
        const commentId = str(value.id)
        const from = obj(value.from)
        const fromId = str(from?.id)
        if (!commentId || (fromId && fromId === entryId)) return null
        return {
            ...blank("instagram", "comment", time, `comment:${commentId}`),
            ig_id: entryId,
            ...senderFor("instagram", fromId),
            sender_name: str(from?.username),
            text: str(value.text),
            comment_id: commentId,
            post_id: str(obj(value.media)?.id),
        }
    }
    if (field === "mentions") {
        const commentId = str(value.comment_id)
        const mediaId = str(value.media_id)
        if (!commentId && !mediaId) return null
        return {
            ...blank("instagram", "mention", time, `mention:${commentId ?? mediaId}`),
            ig_id: entryId,
            comment_id: commentId,
            post_id: mediaId,
        }
    }
    return null
}

/** One `changes` item: messages go the way of the messaging items, the other fields by platform. */
const fromChange = (platform: MetaPlatform, entryId: string | null, change: Obj, time: number): MetaEvent | null => {
    const field = str(change.field)
    const value = obj(change.value)
    if (!field || !value) return null
    if (field === "messages" || field === "messaging_postbacks") return fromMessaging(platform, entryId, value, time)
    return platform === "facebook"
        ? fromFacebookChange(entryId, field, value, time)
        : fromInstagramChange(entryId, field, value, time)
}

/** The platform a webhook object names: "page" is Facebook, "instagram" is Instagram, anything else is none. */
const platformOf = (object: string | null): MetaPlatform | null => {
    if (object === "page") return "facebook"
    return object === "instagram" ? "instagram" : null
}

/**
 * A webhook body to normalised events. Object "page" is Facebook, object "instagram" is Instagram; anything else (or garbage)
 * gives []. Echoes of our own sends, delivery/read receipts, reactions and our own comments are dropped.
 */
export const parseWebhook = (body: unknown, now: number): Array<MetaEvent> => {
    const root = obj(body)
    const object = root ? str(root.object) : null
    const platform = platformOf(object)
    if (!root || !platform) return []
    const out: Array<MetaEvent> = []
    for (const rawEntry of arr(root.entry)) {
        const entry = obj(rawEntry)
        if (!entry) continue
        const entryId = str(entry.id)
        const time = ms(num(entry.time), "s") ?? now
        for (const item of arr(entry.messaging)) {
            const event = fromMessaging(platform, entryId, item, time)
            if (event) out.push(event)
        }
        for (const rawChange of arr(entry.changes)) {
            const change = obj(rawChange)
            if (!change) continue
            const event = fromChange(platform, entryId, change, time)
            if (event) out.push(event)
        }
    }
    return out
}

/** GET /{leadgen_id} to the contact and every answer. Phone numbers keep their digits and a leading plus. */
export const parseLead = (data: unknown): MetaLead => {
    const record = obj(data) ?? {}
    const fields: Record<string, string> = {}
    for (const raw of arr(record.field_data)) {
        const field = obj(raw)
        const name = str(field?.name)
        const value = arr(field?.values)
            .map(str)
            .filter((answer): answer is string => answer !== null)
            .join(", ")
        if (name && value) fields[name] = value
    }
    const pick = (...keys: Array<string>): string | null => {
        for (const key of keys) if (fields[key]) return fields[key]
        return null
    }
    const first = pick("first_name")
    const last = pick("last_name")
    const name = pick("full_name", "name") ?? ([first, last].filter(Boolean).join(" ") || null)
    const phoneRaw = pick("phone_number", "phone")
    const phone = phoneRaw ? phoneRaw.replace(/[^\d+]/gu, "") || null : null
    return {
        name,
        phone,
        email: pick("email"),
        fields,
        ad_id: str(record.ad_id),
        form_id: str(record.form_id),
        created_at: str(record.created_time),
    }
}
