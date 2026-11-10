import { messageOrderShape } from "@nivo-lite/blocks-core"
import { z } from "zod"
import type { ChannelSend, CustomerMessageSend } from "./chat-node-ports.policy"

const ID_MAX = 100
const TEXT_MAX = 4000
const ATTACHMENTS_MAX = 10
const URL_MAX = 2000
const NAME_MAX = 255
const IMAGES_MAX = 10
const CAPTION_MAX = 500

/** A message the back end composed from the records (the payment details of an order with its QR and card). */
export const channelSendSchema: z.ZodType<ChannelSend> = z.object({
    conversationId: z.string().min(1).max(ID_MAX),
    text: z.string().min(1).max(TEXT_MAX),
    attachments: z
        .array(
            z.object({
                url: z.string().min(1).max(URL_MAX),
                name: z.string().min(1).max(NAME_MAX),
                contentType: z.string().min(1).max(NAME_MAX).optional(),
            }),
        )
        .max(ATTACHMENTS_MAX)
        .optional(),
    images: z
        .array(
            z.object({
                url: z.string().min(1).max(URL_MAX),
                caption: z.string().max(CAPTION_MAX),
                version: z.string().max(NAME_MAX).optional(),
            }),
        )
        .max(IMAGES_MAX)
        .optional(),
    order: messageOrderShape.optional(),
})

/** The longest channel key a send may pick. */
const CHANNEL_MAX = 40

/** The words and what the message shows, whatever it is addressed to. */
const content = {
    text: z.string().min(1).max(TEXT_MAX),
    orderId: z.string().min(1).max(ID_MAX).optional(),
    catalogueItemIds: z.array(z.string().min(1).max(ID_MAX)).max(IMAGES_MAX).optional(),
}

/** What the customer send carries: a conversation, or a customer (and a channel to pick among their conversations), with the words. */
export const customerMessageSendSchema: z.ZodType<CustomerMessageSend> = z.union([
    z.object({ conversationId: z.string().min(1).max(ID_MAX), ...content }),
    z.object({ leadId: z.string().min(1).max(ID_MAX), channel: z.string().min(1).max(CHANNEL_MAX).optional(), ...content }),
])
