import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import type { LineOrder } from "@nivo-lite/blocks-core/rules/chatbot"
import type { NodeRow } from "@modules/domain/graph-nodes"
import { imageLinksOf, showsPictures } from "@modules/domain/channels"
import type { ChannelImage } from "@modules/domain/channels"

/** The most rows one node read answers. */
export const NODE_ROWS_MAX = 50

/** One message to a customer conversation. */
export interface ChannelSend {
    /** The conversation. */
    readonly conversationId: string
    /** The text. */
    readonly text: string
    /** Files shared with the text: as links under it, or, on Zalo, the pictures among them as images that follow it. */
    readonly attachments?:
        | ReadonlyArray<{ readonly url: string; readonly name: string; readonly contentType?: string | undefined }>
        | undefined
    /** Pictures with the words under each (name, then price): each channel shows them its best way, one collage image on Zalo, one album on Telegram, links elsewhere. */
    readonly images?: ReadonlyArray<ChannelImage> | undefined
    /** The order the message is about (a snapshot): kept on the stored line so the thread draws the order card. It is not sent to the channel. */
    readonly order?: LineOrder | undefined
}

/** A message to a customer, addressed by the conversation or, for a message the shop starts, by the customer. */
export type CustomerMessageSend =
    | {
          /** The conversation the message goes to. */
          readonly conversationId: string
          /** The words. */
          readonly text: string
          /** The order the message shows the card of. */
          readonly orderId?: string | undefined
          /** Catalogue items shown as pictures. */
          readonly catalogueItemIds?: ReadonlyArray<string> | undefined
      }
    | {
          /** The customer: the message goes to their most recently active conversation. */
          readonly leadId: string
          /** The words. */
          readonly text: string
          /** The channel to pick among the customer's conversations, when given. */
          readonly channel?: string | undefined
          /** The order the message shows the card of. */
          readonly orderId?: string | undefined
          /** Catalogue items shown as pictures. */
          readonly catalogueItemIds?: ReadonlyArray<string> | undefined
      }

/** Why the customer send did not say the message: the id of the refusal fact the agent reads. */
export const SEND_REFUSAL = {
    /** The conversation named is not in the workspace. */
    conversationMissing: "conversation_missing",
    /** The customer named has no conversation (on the channel asked for). */
    noConversation: "no_conversation",
    /** A step of a run that serves one conversation named another one. */
    wrongConversation: "wrong_conversation",
    /** A person of the shop holds the conversation. */
    heldByPerson: "held_by_person",
    /** Another agent holds the conversation. */
    notSpeaking: "not_speaking",
    /** The conversation came in on no connection the workspace still has. */
    connectionMissing: "connection_missing",
    /**
     * The calling agent holds no right to send on the provider of the conversation's channel: it is not attached to it, or the
     * ability is not ticked (the facts say which).
     */
    channelNoAccess: "channel_no_access",
    /** The customer asked the shop not to write to them unprompted. */
    optedOut: "customer_opted_out",
    /** The channel knows no recipient for the customer: the message stays in the conversation marked not sent. */
    recipientNotLinked: "recipient_not_linked",
    /** The customer last wrote on Zalo longer ago than the free window, and an agent's words have no ZNS fallback. */
    outsideWindow: "outside_window",
    /** The plan of the connection does not let the agent answer: the message stays marked not sent. */
    planBlocked: "plan_blocked",
    /** The channel refused the message: it stays marked not sent. */
    notDelivered: "not_delivered",
    /** The owner approves each message on this channel: the draft waits for them. */
    waitsOwner: "waits_owner",
    /** The owner turned the draft down. */
    ownerRejected: "owner_rejected",
} as const

/** What the calling agent's right on the provider of a conversation's channel decided, as the rights judge answers it. */
export type ChannelVerdict =
    | { readonly kind: "allow" | "approval"; readonly provider: string; readonly ability: string }
    | {
          readonly kind: "refuse"
          readonly reason: string
          readonly ability: string
          readonly providers: ReadonlyArray<string>
      }

/** What a send may do: go out at once, wait as a draft for the owner, or not happen (with the facts of why). */
export type SendRight =
    | { readonly kind: "send" }
    | { readonly kind: "draft" }
    | { readonly kind: "refused"; readonly facts: Readonly<Record<string, string>> }

/**
 * What the send may do on the conversation's channel. The calling agent's ability on the channel's provider decides: not attached or
 * not ticked refuses, a tick on `ask` makes the message a draft the owner approves, a tick on `auto` sends. A channel of no provider
 * (NIVO's own website chat) is no provider right and sends. The agent's own approval rule "ask" makes every message a draft whatever
 * the tick says.
 */
export const sendRightOf = (verdict: ChannelVerdict | null, approvalRule: string): SendRight => {
    if (verdict?.kind === "refuse") {
        const [provider] = verdict.providers
        return { kind: "refused", facts: { provider: provider ?? "", ability: verdict.ability, reason: verdict.reason } }
    }
    const asks = verdict?.kind === "approval" || approvalRule.trim().toLowerCase() === "ask"
    return { kind: asks ? "draft" : "send" }
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

/** The copy of the owner's notice of a draft, in one language. */
export interface DraftCopy {
    /** The heading of the team line. */
    readonly title: string
    /** The line before the draft; `{who}` is the customer. */
    readonly lead: string
    /** Who the draft is for when the conversation names nobody. */
    readonly someone: string
}

/** The verdict of a delivery receipt. */
export const verdictOf = (receipt: DeliveryOutcomeFacts): DeliveryVerdict => {
    if (receipt.delivered) return "delivered"
    return receipt.outcome === "ambiguous" ? "unknown" : "not_delivered"
}

/** The words of the team line that asks the owner to approve a draft: who it is for and the draft itself. */
export const draftNoticeOf = (copy: DraftCopy, visitor: string | null, text: string): string =>
    `${copy.lead.replace("{who}", visitor ?? copy.someone)}\n${text}`

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
