import type {
    SandboxCase,
    SandboxCatalogue,
    SandboxInboundCase,
    SandboxInboundContext,
    SandboxInput,
    SandboxInputField,
    SandboxState,
    SandboxWebhookEvent,
} from "@modules/domain/provider-sandbox"
import type { OptionalChannelProfile } from "@modules/domain/provider-registry"

/** The provider key of the Zalo OA catalogue. */
export const ZALO_SANDBOX_PROVIDER = "zalo_oa"

/** One customer of the sandbox OA: Zalo's id of the person, the name and the picture the profile read answers. */
export interface ZaloSandboxCustomer {
    readonly userId: string
    readonly name: string
    readonly picture: string
}

/** The customers of the sandbox OA (fixed ids; the same on every machine). */
export const ZALO_SANDBOX_CUSTOMERS: ReadonlyArray<ZaloSandboxCustomer> = [
    { userId: "8800110022", name: "Nguyen Van An", picture: "https://s75-ava-talk.zadn.vn/sandbox/an.jpg" },
    { userId: "8800110033", name: "Tran Thi Binh", picture: "https://s75-ava-talk.zadn.vn/sandbox/binh.jpg" },
    { userId: "8800110044", name: "Le Minh Chi", picture: "https://s75-ava-talk.zadn.vn/sandbox/chi.jpg" },
    { userId: "8800110055", name: "Pham Quoc Dung", picture: "https://s75-ava-talk.zadn.vn/sandbox/dung.jpg" },
]

/** The profile case that makes the read say nothing (null) for everyone. */
export const ZALO_PROFILE_NONE_CASE = "ZALO-5"

/** The operation of the profile read in the sandbox call log and in the account's next-case selector. */
export const ZALO_PROFILE_OPERATION = "profileOf"

/** What the catalogue says of one person: the customer's name and picture, null for a person the OA does not know (as the live read answers a refusal). */
export const zaloSandboxProfileOf = (personId: string): OptionalChannelProfile => {
    const customer = ZALO_SANDBOX_CUSTOMERS.find((one) => one.userId === personId)
    return customer === undefined ? null : { name: customer.name, picture: customer.picture }
}

/** One customer message the account's cases made, as the OA's chat list reports it and as the webhook delivered it. */
export interface ZaloSandboxMessage {
    /** Zalo's id of the message (`msg_id`, `sbx-zmsg-000001` running per account). */
    readonly messageId: string
    /** The customer who wrote it. */
    readonly userId: string
    /** The kind the chat list reports: `text` or `photo`. */
    readonly kind: "text" | "photo"
    /** The text; empty for a photo. */
    readonly text: string
    /** When Zalo stamped it, epoch milliseconds. */
    readonly sentAt: number
    /** True when it lay outside the 48-hour reply window when it was sent (the ZALO-3 case). */
    readonly stale: boolean
}

/** The state name the messages the account's cases made are kept under (key `""`, an array of `ZaloSandboxMessage`, oldest first): the poll answers them. */
export const ZALO_SANDBOX_MESSAGES_STATE = "messages"

/**
 * The state name of what Zalo remembers of each customer's last line: key = the customer's `userId`, value = epoch milliseconds (a
 * number) of the Zalo timestamp of the customer's latest message. Written by ZALO-1..3, read back by `zaloLastLineAt` (the customer-send
 * sandbox answers `outside_window` when the line is more than 48 hours older than the send).
 */
export const ZALO_SANDBOX_LAST_LINE_STATE = "last-line"

/** Zalo's reply window: 48 hours after the customer's last line. */
export const ZALO_REPLY_WINDOW_MS = 48 * 3_600_000

/** How far before the send's moment the Zalo timestamp of ZALO-3 lies: 49 hours, one hour outside the reply window. */
export const ZALO_SANDBOX_STALE_AGE_MS = 49 * 3_600_000

/** The webhook route of a Zalo OA on NIVO for one account. */
const zaloRoute = (connectionId: string): string => `api/connections/zalo/${connectionId}`

/** The id of the account's next message: `sbx-zmsg-000001` for the first inbound send of the account. */
const messageIdOf = (seq: number): string => `sbx-zmsg-${String(seq + 1).padStart(6, "0")}`

/** The body Zalo's webhook posts for one message (its real event names and members). */
export const zaloWebhookBodyOf = (message: ZaloSandboxMessage): Readonly<Record<string, unknown>> => ({
    app_id: "sandbox-app",
    user_id_by_app: message.userId,
    event_name: message.kind === "photo" ? "user_send_image" : "user_send_text",
    timestamp: String(message.sentAt),
    sender: { id: message.userId },
    recipient: { id: "sandbox-oa" },
    message:
        message.kind === "photo"
            ? {
                  msg_id: message.messageId,
                  attachments: [{ type: "image", payload: { thumbnail: "https://s75-ava-talk.zadn.vn/sandbox/photo.jpg", url: "https://s75-ava-talk.zadn.vn/sandbox/photo.jpg" } }],
              }
            : { msg_id: message.messageId, text: message.text },
})

/** The messages an account's cases made, oldest first (empty for a new account). */
export const zaloMessagesOf = (kept: unknown): ReadonlyArray<ZaloSandboxMessage> =>
    Array.isArray(kept) ? kept.filter((one): one is ZaloSandboxMessage => typeof one === "object" && one !== null && "messageId" in one) : []

/** The Zalo timestamp (epoch ms) of the customer's last line as the account's state holds it, or null when the customer never wrote. */
export const zaloLastLineAt = async (state: Pick<SandboxState, "read">, userId: string): Promise<number | null> => {
    const kept = await state.read(ZALO_SANDBOX_LAST_LINE_STATE, userId)
    return typeof kept === "number" ? kept : null
}

/** The input naming the person (ZALO-1..3). */
const USER_FIELD: SandboxInputField = { name: "userId", label: "Zalo ID của khách / Zalo id of the person", kind: "text", example: "8800110022" }

/** The input holding the line the person writes (ZALO-1 and ZALO-3). */
const TEXT_FIELD: SandboxInputField = { name: "text", label: "Nội dung tin / Message text", kind: "text", example: "Chao shop, cho minh hoi gia bo hoa hong do nhe" }

/** What one inbound case does: the kind of message and how long before the send the Zalo timestamp lies. */
interface ZaloMessagePlan {
    readonly kind: "text" | "photo"
    readonly ageMs: number
}

/**
 * One Zalo inbound case: a customer's message becomes ONE webhook body (id from the account's running number, stamped `at - age`), kept
 * in the account's state (the message for the poll, the time of the customer's last line).
 */
const caseOf = (plan: ZaloMessagePlan, inputs: ReadonlyArray<SandboxInputField>): SandboxInboundCase => ({
    trigger: "message.received",
    path: zaloRoute,
    inputs,
    eventsOf: async (input: SandboxInput, context: SandboxInboundContext): Promise<ReadonlyArray<SandboxWebhookEvent>> => {
        const sentAt = context.at.getTime() - plan.ageMs
        const message: ZaloSandboxMessage = {
            messageId: messageIdOf(context.state.seq),
            userId: typeof input.userId === "string" ? input.userId : "",
            kind: plan.kind,
            text: plan.kind === "text" && typeof input.text === "string" ? input.text : "",
            sentAt,
            stale: plan.ageMs > ZALO_REPLY_WINDOW_MS,
        }
        const kept = zaloMessagesOf(await context.state.read(ZALO_SANDBOX_MESSAGES_STATE, ""))
        await context.state.write(ZALO_SANDBOX_MESSAGES_STATE, "", [...kept, message])
        await context.state.write(ZALO_SANDBOX_LAST_LINE_STATE, message.userId, sentAt)
        return [{ body: zaloWebhookBodyOf(message) }]
    },
})

/**
 * Zalo OA's hardcoded sandbox cases (owner ruling R62): three inbound TRANSFORMATIONS of `{ userId, text }` into the body Zalo posts on
 * `api/connections/zalo/<connectionId>` (a text line, a picture with no text, a text line stamped 49 hours before the send: outside
 * the 48-hour reply window), and the profile read of a known and of an unknown person. State kept: `messages` (the poll answers them) and
 * `last-line` (see `ZALO_SANDBOX_LAST_LINE_STATE`). The customer SEND answers from `zalo-sandbox-send.catalogue.ts` (ZALO-SEND-1..4).
 */
export const ZALO_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: ZALO_SANDBOX_PROVIDER,
    cases: [
        {
            id: "ZALO-1",
            label: "A customer writes a text line: user_send_text stamped at the send",
            inbound: caseOf({ kind: "text", ageMs: 0 }, [USER_FIELD, TEXT_FIELD]),
        },
        {
            id: "ZALO-2",
            label: "A customer sends a picture and no text: user_send_image stamped at the send",
            inbound: caseOf({ kind: "photo", ageMs: 0 }, [USER_FIELD]),
        },
        {
            id: "ZALO-3",
            label: "A customer's text line stamped 49 hours before the send: outside the 48-hour reply window, a later customer send is refused",
            inbound: caseOf({ kind: "text", ageMs: ZALO_SANDBOX_STALE_AGE_MS }, [USER_FIELD, TEXT_FIELD]),
        },
        {
            id: "ZALO-4",
            label: "Profile of a person: the customer's name and picture link, null for a person the OA does not know",
            operation: ZALO_PROFILE_OPERATION,
            default: true,
        },
        {
            id: "ZALO-5",
            label: "Profile read says nothing (null), whoever the person is",
            operation: ZALO_PROFILE_OPERATION,
        },
    ] satisfies ReadonlyArray<SandboxCase>,
}
