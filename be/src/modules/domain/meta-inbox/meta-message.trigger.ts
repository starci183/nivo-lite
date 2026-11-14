import { PROVIDER, TRIGGER, type TriggerVerb } from "@nivo-lite/agent-sdk/names"
import { z } from "zod"
import type { DeclaredLine, OptionalCanonicalEvent, TriggerDeclaration } from "@modules/domain/provider-triggers"
import type { MetaEvent } from "@modules/integrations/meta"
import { isMetaEvent } from "./meta-account.policy"

/** Facebook or Instagram, as the event names it. */
type MetaPlatform = MetaEvent["platform"]

/*
 * THE META CONNECTION'S TWO MESSAGE TRIGGERS (stage 1 of the one event pipeline, concept triggers rule 13): a direct message to a Facebook
 * Page or to an Instagram account, each its own verb, as ONE canonical event. Pure: the translate reads only its argument (the `meta.event`
 * row's event, normalised from Meta's webhook by the integration). Only a direct message with words is a message, as the conversation intake
 * answered: comments, mentions, postbacks and lead ads are dropped here (comments and the reply window are kept by the receipt's own
 * consumer, which wakes nothing).
 */

/** The trigger's name inside the provider. */
export const META_MESSAGE_RECEIVED = "message.received"

/** The data of one direct message (the channel message members of every channel). */
export type MetaMessageData = {
    /** The key the line is stored once under: `meta:<event key>`. */
    readonly messageKey: string
    /** What the person wrote. */
    readonly text: string
    /** When it was sent (ISO 8601). */
    readonly at: string | null
    /** Set only on the engine's release delivery of the channel verb (`held`): no new words. */
    readonly resume?: "held" | undefined
}

/** The `meta.event` row the webhook's receipt kept: the normalised event untouched in `raw`. The translate's raw. */
export interface MetaEventRow {
    /** The event's key, as the row keys it. */
    readonly eventKey: string
    /** The normalised event. */
    readonly raw: MetaEvent
}

/** The direct message of one event on one platform, or null for any other event, another platform, no person or no words. */
const messageOf = (event: MetaEvent, platform: MetaPlatform): OptionalCanonicalEvent<MetaMessageData> => {
    const person = event.sender_psid ?? event.sender_igsid
    if (event.platform !== platform || event.kind !== "dm" || person === null || event.text === null || event.text === "") return null
    return {
        id: event.event_key,
        subject: { channel: platform, id: person, ...(event.sender_name === null ? {} : { name: event.sender_name }) },
        data: {
            messageKey: `meta:${event.event_key}`,
            text: event.text,
            at: new Date(event.timestamp).toISOString(),
        },
    }
}

/** The data schema of a direct message. */
const META_MESSAGE_DATA: z.ZodType<MetaMessageData> = z.object({
    messageKey: z.string(),
    text: z.string(),
    at: z.string().nullable(),
    resume: z.literal("held").optional(),
})

/** The raw schema: the stored `meta.event` row value, its event a normalised Meta event. */
const META_EVENT_ROW: z.ZodType<MetaEventRow> = z.object({
    eventKey: z.string(),
    raw: z.custom<MetaEvent>((value) => isMetaEvent(value)),
})

/** A customer line settles: the run starts once the person has been quiet for 6 s, 20 s after their first line at most (customer-messages rule 13). */
const CHAT_SETTLE = { windowMs: 6000, maxWaitMs: 20_000 } as const

/** The declaration of one platform's message trigger. */
/**
 * The line the person said, as the engine keeps it on the route (owner ruling R26): the message key, the words, the channel's time. The
 * release door's delivery carries no key and is no line. Pure.
 */
export const metaLineOf = (data: MetaMessageData): DeclaredLine | null =>
    data.messageKey === "" ? null : { key: data.messageKey, text: data.text, at: data.at }

const messageTriggerOf = (platform: MetaPlatform, verb: TriggerVerb): TriggerDeclaration<MetaEventRow, MetaMessageData> => ({
    provider: PROVIDER.meta,
    name: `${platform}.${META_MESSAGE_RECEIVED}`,
    verb,
    via: "webhook",
    raw: META_EVENT_ROW,
    data: META_MESSAGE_DATA,
    translate: (row) => messageOf(row.raw, platform),
    line: metaLineOf,
    key: { by: "subject" },
    settle: CHAT_SETTLE,
})

/** A Facebook Page's direct message. */
export const FACEBOOK_MESSAGE_WEBHOOK: TriggerDeclaration<MetaEventRow, MetaMessageData> = messageTriggerOf(
    "facebook",
    TRIGGER.facebookMessageReceived,
)

/** An Instagram account's direct message. */
export const INSTAGRAM_MESSAGE_WEBHOOK: TriggerDeclaration<MetaEventRow, MetaMessageData> = messageTriggerOf(
    "instagram",
    TRIGGER.instagramMessageReceived,
)

/** Every trigger the Meta provider declares. */
export const META_TRIGGERS: ReadonlyArray<TriggerDeclaration<MetaEventRow, MetaMessageData>> = [
    FACEBOOK_MESSAGE_WEBHOOK,
    INSTAGRAM_MESSAGE_WEBHOOK,
]

/** The declaration of the event's platform (the provider's own `platform` field), the one whose translate may answer the row. */
export const metaMessageTriggerOf = (row: MetaEventRow): TriggerDeclaration<MetaEventRow, MetaMessageData> =>
    row.raw.platform === "instagram" ? INSTAGRAM_MESSAGE_WEBHOOK : FACEBOOK_MESSAGE_WEBHOOK
