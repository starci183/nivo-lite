import type { LineOrder } from "../customer-send"
import { TOOL } from "../names/tool"
import { z } from "../schema/zod-entry"
import { defineEffect } from "./effect"
import type { EffectDefinition } from "./effect.types"

/** The longest id, line of words and body a payload of the send accepts, and the most pictures one message carries (one Telegram album holds ten). */
const ID_MAX = 200
const LINE_MAX = 500
const BODY_MAX = 20_000
const PICTURES_MAX = 10
const PICTURE_URL_MAX = 2000
const PICTURE_CAPTION_MAX = 500
/** The most ordered items the card of a line shows. */
const CARD_ITEMS_MAX = 50

/** What every message to a customer carries, whoever it is addressed to. */
interface ChannelSendCommon {
    /** The words of the message. */
    readonly text: string
    /**
     * The card the stored line shows beside its words (the order the message is about), finished by the package's step that built it from
     * its records: the engine checks its shape and stores it as it is, and reads nothing of it.
     */
    readonly order?: LineOrder | undefined
    /** Catalogue items to show as pictures, at most ten: each goes with the catalogue's own name and price. */
    readonly catalogueItemIds?: ReadonlyArray<string> | undefined
    /** Pictures the node already holds the address of (a QR a tool answered, a photo), each with its caption: at most ten in all. */
    readonly images?: ReadonlyArray<{ readonly url: string; readonly caption: string }> | undefined
}

/**
 * A message to a PERSON: the core contact, on one of the channels they are known on; or to the person of a ROUTE (`routeId`: the route a
 * record came in on), on that route's channel and account. The engine resolves the contact's channel identity (the channel, the account,
 * the channel's id of them) and the route; every rule of the send (holds, consent, rights, the node's mode) is the same either way.
 */
export type ChannelSendPayload = ChannelSendCommon & {
    /**
     * The route to speak on (the route a record came in on, as a trigger handed it: `trigger.routeId`): its person, channel and account
     * are the address. Named with no `contactId`, `channel` or `accountId`. For a run that serves no person (a clock round, a team-chat
     * turn) addressing a person a stored record names by its route.
     */
    readonly routeId?: string | undefined
    /** The person (the core contact). Absent: the person the run serves. */
    readonly contactId?: string | undefined
    /** The channel to use when the person is known on more than one (zalo, telegram, facebook, instagram, website). Absent: the route the run was woken on. */
    readonly channel?: string | undefined
    /** The account (the connection id) to use when the person is known on several of one channel. Absent: the route the run was woken on. */
    readonly accountId?: string | undefined
}

const id = z.string().min(1).max(ID_MAX)

/** The card of a line as the customer saw it: the shape of `LineOrder`, checked field by field. */
export const lineOrderSchema: z.ZodType<LineOrder> = z.object({
    orderNo: z.string().max(LINE_MAX),
    lines: z
        .array(
            z.object({
                name: z.string().max(LINE_MAX),
                qty: z.number(),
                unitText: z.string().max(LINE_MAX).optional(),
                amountText: z.string().max(LINE_MAX).optional(),
                imageUrl: z.string().max(BODY_MAX).nullable().optional(),
            }),
        )
        .max(CARD_ITEMS_MAX),
    amountText: z.string().max(LINE_MAX),
    address: z.string().max(LINE_MAX),
    paid: z.boolean(),
})

/** What a MODEL's call may carry: words, catalogue pictures and tool-given pictures; never the card of an order. */
const channelSendModelCommon = {
    text: z
        .string()
        .min(1)
        .max(BODY_MAX)
        .describe(
            "The words to send, in the customer's language. Never write a price or a total you did not read from a tool.",
        ),
    catalogueItemIds: z
        .array(id)
        .max(PICTURES_MAX)
        .optional()
        .describe(
            "Catalogue items to show as pictures (at most 10); each is sent with the catalogue's own name and price.",
        ),
    images: z
        .array(
            z.object({
                url: z
                    .string()
                    .min(1)
                    .max(PICTURE_URL_MAX)
                    .describe("The address of the picture, as a tool answered it."),
                caption: z.string().max(PICTURE_CAPTION_MAX).describe("The words under the picture."),
            }),
        )
        .max(PICTURES_MAX)
        .optional()
        .describe(
            "Pictures to show whose address a tool answered (the QR of a payment request); at most 10 with the catalogue pictures. Never an address you made up.",
        ),
}

/** What package CODE may carry besides: the card of the order the message is about, finished by the step that built it from its records. */
const channelSendCodeCommon = {
    ...channelSendModelCommon,
    order: lineOrderSchema
        .optional()
        .describe("The card of the order this message is about, built by the step from the order record."),
}

const channelSendPayloadOf = (
    common: typeof channelSendModelCommon | typeof channelSendCodeCommon,
): z.ZodType<ChannelSendPayload> =>
    z
        .object({
            routeId: id
                .optional()
                .describe(
                    "The route to speak on (the route a record came in on). Its person, channel and account are the address: name no contactId, channel or accountId with it.",
                ),
            contactId: id
                .optional()
                .describe("The person (the core contact) to speak to. Leave it out to speak to the person this run serves."),
            channel: id
                .optional()
                .describe("The channel to use when the person has more than one (zalo, telegram, facebook, instagram, website). Leave it out for the channel they wrote on."),
            accountId: id
                .optional()
                .describe("The account (connection id) to use when the person is known on several of one channel. Leave it out for the account they wrote on."),
            ...common,
        })
        .refine(
            (payload) =>
                payload.routeId === undefined ||
                (payload.contactId === undefined && payload.channel === undefined && payload.accountId === undefined),
            { message: "A send addressed by its route names no contactId, channel or accountId besides.", path: ["routeId"] },
        )
        .describe(
            "Send one message to a person on one of their channels (by default the one they wrote on). The answer is the delivery receipt: how it ended, and why not when it was not delivered.",
        )

/** The shape of a MODEL's call of the send (the effect's `payload`): no order card, so no model types an amount or a "paid" onto a customer line. */
const channelSendPayload = channelSendPayloadOf(channelSendModelCommon)

/** The shape package CODE sends (the effect's `codePayload`): the model's, and the finished card of an order. */
export const channelSendCodePayload: z.ZodType<ChannelSendPayload> = channelSendPayloadOf(channelSendCodeCommon)

/**
 * Sends a message to a person; the subject is the message. The send is how NIVO speaks to a customer (`nivo.tool.customer.message.send`),
 * so the effect is the engine's: a package lists it in its `effects` (the core package does) and its title words come from the package.
 */
export const channelSendEffect: EffectDefinition<z.ZodType<ChannelSendPayload>> = defineEffect({
    id: TOOL.customerMessageSend,
    title: { key: "effectChannelSend" },
    payload: channelSendPayload,
    codePayload: channelSendCodePayload,
})
