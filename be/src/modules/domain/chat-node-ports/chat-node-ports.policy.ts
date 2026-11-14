import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import type { LineOrder } from "@nivo-lite/agent-sdk/customer-send"
import type { NodeRow } from "@modules/domain/graph-nodes"
import { imageLinksOf, showsPictures, type ChannelImage } from "@modules/domain/channels"

/** The most rows one node read answers. */
export const NODE_ROWS_MAX = 50

/** What one message carries, whoever it goes to: the words and what they show. */
export interface ChannelSend {
    /** The text. */
    readonly text: string
    /** Files shared with the text: as links under it, or, on Zalo, the pictures among them as images that follow it. */
    readonly attachments?:
        | ReadonlyArray<{ readonly url: string; readonly name: string; readonly contentType?: string | undefined }>
        | undefined
    /** Pictures with the words under each (name, then price): each channel shows them its best way, one collage image on Zalo, one album on Telegram, links elsewhere. */
    readonly images?: ReadonlyArray<ChannelImage> | undefined
    /** The order the message is about (a snapshot): kept by the node on its own line so the thread draws the order card. It is not sent to the channel. */
    readonly order?: LineOrder | undefined
}

/** A message to a person: the core contact (absent: the person the run serves), on a channel and an account (absent: the route the run was woken on). */
export interface CustomerMessageSend {
    /** The words. */
    readonly text: string
    /** The route to speak on (the route a record came in on): its person, channel and account are the address; named alone. */
    readonly routeId?: string | undefined
    /** The person. */
    readonly contactId?: string | undefined
    /** The channel, when the person is known on more than one. */
    readonly channel?: string | undefined
    /** The account (the connection id), when the person is known on several of one channel. */
    readonly accountId?: string | undefined
    /** The card the message shows beside its words, finished by the step that built it from its records. */
    readonly order?: LineOrder | undefined
    /** Pictures the caller holds the address of (a payment QR), each with its caption. */
    readonly images?: ReadonlyArray<{ readonly url: string; readonly caption: string }> | undefined
}

/**
 * Why the customer send did not say the message: the id of the refusal fact the agent reads. A send addresses a person, so the engine
 * answers no conversation id (`conversation_missing`, `no_conversation`, `wrong_conversation`). A member of the shop holding the
 * route (the staff hold, ruling R43) is the engine's own check: `route_held`.
 */
export const SEND_REFUSAL = {
    /** The call names no person and the run serves none. */
    noRecipient: "no_recipient",
    /** The person is known on no channel (on the one asked for). */
    noChannelIdentity: "no_channel_identity",
    /** The person is known on several channels or accounts and the call and the run name none. */
    channelAmbiguous: "channel_ambiguous",
    /** A member of the shop holds the route (took the thread over): no AI send goes until it is handed back (ruling R43). */
    routeHeld: "route_held",
    /** The person came in on no connection the workspace still has. */
    connectionMissing: "connection_missing",
    /**
     * The calling agent holds no right to send on the provider of the channel: it is not attached to it, or the
     * ability is not ticked (the facts say which).
     */
    channelNoAccess: "channel_no_access",
    /** The customer asked the shop not to write to them unprompted. */
    optedOut: "customer_opted_out",
    /** The channel knows no recipient for the customer: the delivery ledger keeps the message marked not sent. */
    recipientNotLinked: "recipient_not_linked",
    /** The customer last wrote on Zalo longer ago than the free window, and an agent's words have no ZNS fallback. */
    outsideWindow: "outside_window",
    /** The plan of the connection does not let the agent answer: the ledger keeps the message marked not sent. */
    planBlocked: "plan_blocked",
    /** The channel refused the message: the ledger keeps it marked not sent. */
    notDelivered: "not_delivered",
} as const

/** The refusal a send answers (one of `SEND_REFUSAL`). */
export type SendRefusalReason = (typeof SEND_REFUSAL)[keyof typeof SEND_REFUSAL]

/** How a send ended, as the receipt says it. */
export type ReceiptState = "delivered" | "refused" | "unknown"

/**
 * The delivery RECEIPT: what the send answers as its facts, on a success and on a refusal that got as far as a route. The node writes its
 * own line from it; the engine stores no agent line.
 */
export interface CustomerMessageReceipt {
    /** True only when the provider took the message. */
    readonly delivered: boolean
    /** delivered, refused, or unknown (the outcome is ambiguous: no machine sends it again). */
    readonly state: ReceiptState
    /** The refusal when the state is not delivered (an unknown outcome names its cause when there is one). */
    readonly reason: string | null
    /** The person. */
    readonly contactId: string
    /** The channel. */
    readonly channel: string
    /** The account (connection id; the site id of the website). */
    readonly accountId: string | null
    /** The route the message went on. */
    readonly routeId: string
    /** The id the provider gave the message, or null when none came back. */
    readonly providerMessageId: string | null
    /** The Zalo route that carried it (`consultation`, `zns`), when it went over Zalo. */
    readonly via?: string | undefined
    /** When the provider answered, ISO (the engine's clock); null when it was never asked. */
    readonly at: string | null
    /** The once-key of the send: the node's own line carries it. */
    readonly sendKey: string
}

/** What the calling agent's attachment to the provider of a conversation's channel decided, as the rights judge answers it. */
export type ChannelVerdict =
    | { readonly kind: "allow" | "approval"; readonly provider: string; readonly ability: string }
    | {
          readonly kind: "refuse"
          readonly reason: string
          readonly ability: string
          readonly providers: ReadonlyArray<string>
      }

/** What a send may do: go out, or not happen (with the facts of why). */
export type SendRight = { readonly kind: "send" } | { readonly kind: "refused"; readonly facts: Readonly<Record<string, string>> }

/**
 * What the send may do on the conversation's channel. The calling agent's attachment to the channel's provider decides: not attached
 * refuses, an attached one sends. A channel of no provider (NIVO's own website chat) is no provider right and sends. Whether a person
 * approves first is the node's mode, asked by the tool door before the executor runs, never here.
 */
export const sendRightOf = (verdict: ChannelVerdict | null): SendRight => {
    if (verdict?.kind === "refuse") {
        const [provider] = verdict.providers
        return { kind: "refused", facts: { provider: provider ?? "", ability: verdict.ability, reason: verdict.reason } }
    }
    return { kind: "send" }
}

/** What the channel said of a message: it took it, it refused it, or nobody knows. */
export type DeliveryVerdict = "delivered" | "not_delivered" | "unknown"

/** What a delivery receipt says, as far as the verdict goes. */
export interface DeliveryOutcomeFacts {
    /** True only when the channel took the message. */
    readonly delivered: boolean
    /** acknowledged, rejected or ambiguous. */
    readonly outcome: string
}

/** The verdict of a delivery receipt. */
export const verdictOf = (receipt: DeliveryOutcomeFacts): DeliveryVerdict => {
    if (receipt.delivered) return "delivered"
    return receipt.outcome === "ambiguous" ? "unknown" : "not_delivered"
}

/** How many rows a query asks for, kept between one and the most a read answers. */
export const limitOf = (query: NodeQuery): number => Math.min(Math.max(query.limit ?? NODE_ROWS_MAX, 1), NODE_ROWS_MAX)

/** The row cut to the asked fields. */
export const cutFields = (row: NodeRow, fields: ReadonlyArray<string>): NodeRow =>
    Object.fromEntries(fields.map((field) => [field, row[field]]))

/** Whether a row matches every `where` entry. */
export const matchesWhere = (row: NodeRow, where: NodeQuery["where"]): boolean =>
    Object.entries(where ?? {}).every(([name, value]) => row[name] === value)

/** The text with its attachments as links under it, one per line. */
export const textWithLinks = (send: ChannelSend): string =>
    [send.text, ...(send.attachments ?? []).map((file) => `${file.name}: ${file.url}`)].join("\n")

/** What goes out for one send on one channel: the text, and the pictures that follow it. */
export interface Outbound {
    /** The text, with the files and pictures the channel cannot show as pictures as links under it. */
    readonly text: string
    /** The pictures, in order, with their captions; empty on a channel that cannot show them. */
    readonly images: ReadonlyArray<ChannelImage>
}

const isImage = (contentType: string | undefined): boolean => contentType?.toLowerCase().startsWith("image/") === true

/**
 * The text and pictures one send puts out. Zalo shows the image files and the `images` as pictures after the text, Telegram shows the `images`
 * (its files stay links); every other channel keeps every file and picture as a link under the text.
 */
export const outboundOf = (send: ChannelSend, channel: string): Outbound => {
    const files = send.attachments ?? []
    const images = send.images ?? []
    if (!showsPictures(channel)) {
        return { text: [textWithLinks(send), ...imageLinksOf(images)].join("\n"), images: [] }
    }
    if (channel === "telegram") return { text: textWithLinks(send), images }
    return {
        text: textWithLinks({ ...send, attachments: files.filter((file) => !isImage(file.contentType)) }),
        images: [
            ...files.filter((file) => isImage(file.contentType)).map((file) => ({ url: file.url, caption: file.name })),
            ...images,
        ],
    }
}

export { RECIPIENT_NOT_LINKED, recipientLinked } from "@modules/domain/channels"

/** A Zalo user id is a string of digits; an import writes a placeholder sender in its place. */
const ZALO_USER_ID = /^\d+$/u

/** The customer a conversation reaches: the channel and the id the channel knows them by. */
export interface RecipientTarget {
    /** The channel of the conversation. */
    readonly channel: string
    /** The customer's id on that channel, or null when it holds none. */
    readonly externalId: string | null
}

/** True when a Zalo conversation names a customer that is no Zalo user (an imported conversation's placeholder sender), so nothing can reach them. */
export const placeholderRecipient = (target: RecipientTarget): boolean =>
    target.channel === "zalo" &&
    target.externalId !== null &&
    !ZALO_USER_ID.test(target.externalId.split(":", 1).join(""))

/** The Zalo refusals that say the recipient cannot be reached at all: the user is unknown or invalid, or does not follow the OA. */
const UNREACHABLE_FAILURES: ReadonlySet<string> = new Set(["zalo_recipient", "zalo_unfollowed"])

/** True when the channel refused a message because of who it was for, not because of the window, the quota or its own state. */
export const recipientRefused = (failure: string | null): boolean =>
    failure !== null && UNREACHABLE_FAILURES.has(failure)

/** The Zalo refusals that say the channel is not taking messages right now, so nothing was sent and a later try can go out: the quota of the account and the night hours. */
const BUSY_FAILURES: ReadonlySet<string> = new Set(["zalo_quota", "zalo_night_hours"])

/** True when the channel refused a message for now (its quota, the night hours), not for good: the step is tried again after a backoff. */
export const channelBusy = (failure: string | null): boolean => failure !== null && BUSY_FAILURES.has(failure)
