import { TRIGGER_SOURCES, type SuppliedParam, type TriggerSource } from "@nivo-lite/agent-sdk/graph"
import { PROVIDER, TRIGGER, type ProviderKey, type TriggerVerb } from "@nivo-lite/agent-sdk/names"
import { z, type ZodType } from "zod"
import {
    ENGINE_ROAD,
    type SourceNarrowing,
    type StreamIdentity,
    type TriggerAdapterSpec,
    type TriggerArgs,
    type TriggerSpec,
} from "./trigger-specs.contracts"

/*
 * The names of the provider triggers and system tag sources below are the ones their owners declare (`PROVIDER_TRIGGERS` of
 * provider-triggers, the tag sources of billing, inbox-leads and agent-schedules); they are written here as plain values so that loading
 * the registry evaluates nothing of another capability, and `trigger-specs.registry.spec.ts` holds each equal to its owner's.
 */

/** The bank feed's event, as every bank feed provider declares it. */
const TRANSACTION_RECEIVED = "transaction.received"

/** The mailbox's event, as the IMAP provider declares it. */
const MAIL_RECEIVED = "mail.received"

/** The tag source of a website order form's wake (inbox-leads). */
const WEBSITE_LEAD_TAG = "website_lead"

/** The tag source of a care timer's wake (agent-schedules). */
const CARE_TIMER_TAG = "care-timer"

/*
 * WHAT EACH VERB SUPPLIES is the GENERIC trigger scope of the one event pipeline (lane concept triggers rule 13; ROAD-API section 3.1):
 * `eventId`, `accountId`, `contactId`, `routeId`, `subject`, `data` (its members declared per kind) and `locale`. The table is the SDK's
 * (`TRIGGER_SOURCES[kind].supplies`, built from `TRIGGER_SCOPE`), so the engine and the @1 checks read one list and no channel, chat or
 * tag-door member is declared here. The words of a line, its time and its pictures are members of `data`, rebuilt when the run starts by
 * the source's pure `translate` over the stored raw row.
 */

/** What a customer channel's event supplies (the four channels alike): the person on the account, and the line as `data`. */
const CHANNEL_MEMBERS: ReadonlyArray<SuppliedParam> = TRIGGER_SOURCES.zalo.supplies

/**
 * The subject of an event about a person: the contact, else the conversation (a person no contact holds yet). A channel line names
 * both; a workflow call names what its caller maps of the person (`contactId`).
 */
const CUSTOMER_SUBJECT: ReadonlyArray<string> = ["contactId", "routeId"]

/** The subject of a workflow call: what its caller maps of the person (the callee's contract keeps `conversationId` as its route input). */
const CALLED_SUBJECT: ReadonlyArray<string> = ["contactId", "conversationId"]

/** What a website form's event supplies: the person on the site, and the request with the contact details given (claims) as `data`. */
const WEBSITE_MEMBERS: ReadonlyArray<SuppliedParam> = TRIGGER_SOURCES.website.supplies

/** What a due timer supplies: its task, the caller's key, the moment and the armed data as `data`, the person when the arm had one. */
const TIMER_MEMBERS: ReadonlyArray<SuppliedParam> = TRIGGER_SOURCES.timer.supplies

/** What a clock tick supplies: the slot it fired for, as `data.slotMs`. */
const CLOCK_MEMBERS: ReadonlyArray<SuppliedParam> = TRIGGER_SOURCES.schedule.supplies

/** What a team chat line supplies: the words, the member and the room thread, as `data`. */
const CHAT_MEMBERS: ReadonlyArray<SuppliedParam> = TRIGGER_SOURCES["chats-group"].supplies

/** A verb that takes no args. */
const NO_ARGS: ZodType<TriggerArgs> = z.object({}).strict()

/** The args of the clock: the preset of the schedule and, for the presets that name one, the time of day (`HH:MM`). */
const CLOCK_ARGS: ZodType<TriggerArgs> = z
    .object({ preset: z.string().min(1).max(40), at: z.string().max(5).regex(/^\d{2}:\d{2}$/u).optional() })
    .strict()

/** A source of today of one kind, on any connection. */
const kind = (sourceKind: Exclude<TriggerSource["kind"], "provider">): TriggerSource => ({ kind: sourceKind, connectionId: null })

/** A provider trigger of today, on any account. */
const providerTrigger = (provider: ProviderKey, name: string): TriggerSource => ({
    kind: "provider",
    connectionId: null,
    provider,
    trigger: name,
})

/** A bank credit is one `payment.transaction` record, whichever bank feed brought it: the record id its provider trigger carries. */
const CREDIT_KEY = { kind: "record", prefix: "credit", member: "transactionId" } as const

/**
 * A bank feed's `transaction.received` carries every movement of the account (`data.direction` `in` or `out` in the event's generic
 * scope, as each feed's translate writes it); a CREDIT is the movement in: every registration the engine derives on it for
 * `payment.credit.received` carries `data.direction = in` (read by path, like every `where` of the one pipeline).
 */
const CREDITS_ONLY: SourceNarrowing = {
    trigger: TRANSACTION_RECEIVED,
    where: [{ param: "data.direction", op: "equals", value: "in" }],
}

/*
 * THE STREAM IDENTITIES (owner key `triggerOneSource2026_11_12`, CORRECTED 2026-11-12): what each provider's connection stores in its public
 * facts (`connections.public_meta`, written by the provider's connect road) that names the stream its account reads.
 */

/**
 * A bank feed's stream is the BANK ACCOUNT: the bank code (`bank_code`, upper-case: the money wizard stores it so) and the full account
 * number (`account_number`, digits only; `account_masked` is a display form, never an identity), the same kind for every feed, so SePay
 * and Casso on one bank account read ONE stream.
 */
const BANK_ACCOUNT_STREAM: StreamIdentity = {
    kind: "bank-account",
    facts: [
        { key: "bank_code", form: "upper-case" },
        { key: "account_number", form: "digits" },
    ],
}

/** A mailbox's stream is its address (`email`, lower-case: the IMAP connect road stores it). */
const MAILBOX_STREAM: StreamIdentity = { kind: "mailbox", facts: [{ key: "email", form: "lower-case" }] }

/** A Zalo OA's stream is the OA (`oa_id`). */
const ZALO_OA_STREAM: StreamIdentity = { kind: "zalo-oa", facts: [{ key: "oa_id", form: "trimmed" }] }

/** A Telegram bot's stream is the bot (`bot_id`, the numeric id; the username can change). */
const TELEGRAM_BOT_STREAM: StreamIdentity = { kind: "telegram-bot", facts: [{ key: "bot_id", form: "trimmed" }] }

/** A Facebook channel's stream is the Page (`page_id` of the Meta connection). */
const FACEBOOK_PAGE_STREAM: StreamIdentity = { kind: "facebook-page", facts: [{ key: "page_id", form: "trimmed" }] }

/** An Instagram channel's stream is the Instagram account (`ig_id` of the same Meta connection). */
const INSTAGRAM_ACCOUNT_STREAM: StreamIdentity = { kind: "instagram-account", facts: [{ key: "ig_id", form: "trimmed" }] }

/** The trigger a compose provider emits for a finished render, as the provider trigger catalogue declares it. */
const RENDER_COMPLETED = "render.completed"

/** A compose account's renders are its own (no two accounts report one render): every account is its own stream. */
const COMPOSE_ACCOUNT_STREAM: StreamIdentity = { kind: "compose-account", ownAccount: true }

/** A render is one `<provider>.render` row, whichever webhook delivery brought it: the row id its provider trigger carries. */
const RENDER_KEY = { kind: "record", prefix: "render", member: "renderRowId" } as const

/** A compose provider's render completion: its webhook trigger alone (on by default, rule 6a), each account its own stream. */
const composeRender = (provider: ProviderKey): TriggerAdapterSpec => ({
    provider,
    receivedBy: "webhook",
    road: "system-event",
    sources: [providerTrigger(provider, RENDER_COMPLETED)],
    eventKey: RENDER_KEY,
    stream: COMPOSE_ACCOUNT_STREAM,
})

/** A bank feed provider served by the provider road alone (its switch decides), credits only. */
const bankFeed = (provider: ProviderKey): TriggerAdapterSpec => ({
    provider,
    receivedBy: "webhook",
    road: "system-event",
    sources: [providerTrigger(provider, TRANSACTION_RECEIVED)],
    eventKey: CREDIT_KEY,
    narrows: [CREDITS_ONLY],
    stream: BANK_ACCOUNT_STREAM,
})

/** The customer channels: each is a source kind of the @1 envelope, named as a conversation names its channel. */
type CustomerChannel = "zalo" | "telegram" | "facebook" | "instagram"

/** A customer channel's adapter: the channel intake, the channel members, the wake's own key, the stream its account reads. */
const channelAdapter = (provider: ProviderKey, channel: CustomerChannel, stream: StreamIdentity): TriggerAdapterSpec => ({
    provider,
    receivedBy: "channel",
    road: "channel",
    supplies: CHANNEL_MEMBERS,
    sources: [kind(channel)],
    eventKey: { kind: "wake" },
    stream,
})

/** The Zalo OA channel's adapter. */
const ZALO_CHANNEL: TriggerAdapterSpec = channelAdapter(PROVIDER.zaloOa, "zalo", ZALO_OA_STREAM)

/** The Telegram channel's adapter. */
const TELEGRAM_CHANNEL: TriggerAdapterSpec = channelAdapter(PROVIDER.telegram, "telegram", TELEGRAM_BOT_STREAM)

/** The Facebook channel's adapter: a Page's direct messages, received by the Meta webhook and handed to the channel intake. */
const FACEBOOK_CHANNEL: TriggerAdapterSpec = channelAdapter(PROVIDER.meta, "facebook", FACEBOOK_PAGE_STREAM)

/** The Instagram channel's adapter: an Instagram account's direct messages, on the same Meta connection as its Page. */
const INSTAGRAM_CHANNEL: TriggerAdapterSpec = channelAdapter(PROVIDER.meta, "instagram", INSTAGRAM_ACCOUNT_STREAM)

/** The website form's adapter: the engine's road, tagged by inbox-leads. */
const WEBSITE_FORM: TriggerAdapterSpec = {
    provider: ENGINE_ROAD,
    receivedBy: "engine",
    road: "system-event",
    supplies: WEBSITE_MEMBERS,
    sources: [kind("website")],
    tagSource: WEBSITE_LEAD_TAG,
    eventKey: { kind: "wake" },
}

/**
 * THE REGISTRY: one spec per verb of `TRIGGER`, TOTAL (a verb without a spec does not compile). The adapters wrap today's sources: each
 * customer channel its own verb (`zalo.message.received`, `telegram.message.received`, and Meta's two channels `facebook.message.received`
 * and `instagram.message.received`, provider `meta`: the Meta webhook hands a Page's or an Instagram account's direct message to the
 * channel intake, which wakes the front-door agent on the `channel` road) and the website form its own (`website.message.received`, the
 * engine's road), the bank feeds' provider triggers (`payment.credit.received`), the mailbox's provider trigger, the compose
 * providers' render triggers (`video.render.completed`),
 * and the engine's own roads (clock, timer, team chat, workflow call). There is no verb of every customer channel (ruling R6: the old one
 * went at the flip; the rename table maps each old trigger kind to its channel's verb).
 */
export const TRIGGERS: Readonly<Record<TriggerVerb, TriggerSpec>> = {
    [TRIGGER.zaloMessageReceived]: {
        verb: TRIGGER.zaloMessageReceived,
        args: NO_ARGS,
        payload: "message",
        supply: "fixed",
        subject: CUSTOMER_SUBJECT,
        adapters: [ZALO_CHANNEL],
    },
    [TRIGGER.telegramMessageReceived]: {
        verb: TRIGGER.telegramMessageReceived,
        args: NO_ARGS,
        payload: "message",
        supply: "fixed",
        subject: CUSTOMER_SUBJECT,
        adapters: [TELEGRAM_CHANNEL],
    },
    [TRIGGER.facebookMessageReceived]: {
        verb: TRIGGER.facebookMessageReceived,
        args: NO_ARGS,
        payload: "message",
        supply: "fixed",
        subject: CUSTOMER_SUBJECT,
        adapters: [FACEBOOK_CHANNEL],
    },
    [TRIGGER.instagramMessageReceived]: {
        verb: TRIGGER.instagramMessageReceived,
        args: NO_ARGS,
        payload: "message",
        supply: "fixed",
        subject: CUSTOMER_SUBJECT,
        adapters: [INSTAGRAM_CHANNEL],
    },
    [TRIGGER.websiteMessageReceived]: {
        verb: TRIGGER.websiteMessageReceived,
        args: NO_ARGS,
        payload: "message",
        supply: "fixed",
        subject: ["contactId"],
        adapters: [WEBSITE_FORM],
    },
    [TRIGGER.paymentCreditReceived]: {
        verb: TRIGGER.paymentCreditReceived,
        args: NO_ARGS,
        payload: "ids",
        supply: "fixed",
        subject: ["transactionId"],
        // Every bank feed's `<provider>.transaction` row (sepay, casso, payos: one declaration, `bank.transaction`) holds these fields.
        reads: {
            member: "transactionId",
            purpose: "bank.transaction",
            fills: [
                { name: "amountVnd", field: "amount", type: "integer" },
                { name: "content", field: "content", type: "string" },
                { name: "at", field: "at", type: "string" },
                { name: "account", field: "account", type: "string" },
                { name: "bankRef", field: "bankRef", type: "string" },
            ],
        },
        adapters: [bankFeed(PROVIDER.sepay), bankFeed(PROVIDER.casso), bankFeed(PROVIDER.payos)],
    },
    [TRIGGER.mailMessageReceived]: {
        verb: TRIGGER.mailMessageReceived,
        args: NO_ARGS,
        payload: "ids",
        supply: "fixed",
        subject: [],
        adapters: [
            {
                provider: PROVIDER.imap,
                receivedBy: "poll",
                road: "system-event",
                sources: [providerTrigger(PROVIDER.imap, MAIL_RECEIVED)],
                eventKey: { kind: "span", prefix: "mail", member: "eventIds" },
                stream: MAILBOX_STREAM,
            },
        ],
    },
    [TRIGGER.videoRenderCompleted]: {
        verb: TRIGGER.videoRenderCompleted,
        args: NO_ARGS,
        payload: "ids",
        supply: "fixed",
        // The run that asked for the render waits for it by its own render id.
        subject: ["renderId"],
        // Every compose provider's `<provider>.render` row (one declaration, `video.render`) holds these fields.
        reads: {
            member: "renderRowId",
            purpose: "video.render",
            fills: [
                { name: "outputUrl", field: "outputUrl", type: "string" },
                { name: "error", field: "error", type: "string" },
                { name: "provider", field: "provider", type: "string" },
            ],
        },
        adapters: [composeRender(PROVIDER.shotstack), composeRender(PROVIDER.creatomate), composeRender(PROVIDER.json2video)],
    },
    [TRIGGER.clockTick]: {
        verb: TRIGGER.clockTick,
        args: CLOCK_ARGS,
        payload: "ids",
        supply: "fixed",
        subject: [],
        adapters: [
            {
                provider: ENGINE_ROAD,
                receivedBy: "engine",
                road: "schedule",
                supplies: CLOCK_MEMBERS,
                sources: [kind("schedule")],
                eventKey: { kind: "wake" },
            },
        ],
    },
    [TRIGGER.timerDue]: {
        verb: TRIGGER.timerDue,
        args: NO_ARGS,
        payload: "ids",
        supply: "fixed",
        subject: ["contactId", "routeId"],
        adapters: [
            {
                provider: ENGINE_ROAD,
                receivedBy: "engine",
                road: "system-event",
                supplies: TIMER_MEMBERS,
                sources: [kind("timer")],
                tagSource: CARE_TIMER_TAG,
                eventKey: { kind: "wake" },
            },
        ],
    },
    [TRIGGER.chatMessageReceived]: {
        verb: TRIGGER.chatMessageReceived,
        args: NO_ARGS,
        payload: "message",
        supply: "fixed",
        subject: [],
        adapters: [
            {
                provider: ENGINE_ROAD,
                receivedBy: "engine",
                road: "chats-group",
                supplies: CHAT_MEMBERS,
                sources: [kind("chats-group")],
                eventKey: { kind: "wake" },
            },
        ],
    },
    [TRIGGER.workflowCalled]: {
        verb: TRIGGER.workflowCalled,
        args: NO_ARGS,
        payload: "ids",
        supply: "caller",
        subject: CALLED_SUBJECT,
        // A call supplies exactly what its caller maps (`supply: caller`): the callee's contract, never a fixed member.
        adapters: [
            {
                provider: ENGINE_ROAD,
                receivedBy: "engine",
                road: "agent",
                supplies: [],
                sources: [kind("workflow")],
                eventKey: { kind: "wake" },
            },
        ],
    },
}
