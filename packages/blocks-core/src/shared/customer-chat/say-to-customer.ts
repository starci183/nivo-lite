import type { LineOrder } from "@nivo-lite/agent-sdk/customer-send"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { asJson, type NodeContext } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../bounds"
import { CHATBOT_CHAT_ENTITY } from "../entities/chatbot-entity-names"
import { entitiesOverRecordTools } from "./record-tools.entities"

/** A picture a node sends: where it is served from, and the words under it. */
export interface SentImage {
    /** Where the picture is served from. */
    readonly url: string
    /** The words under it. */
    readonly caption: string
}

/** What a node says to the customer. */
export interface SayInput {
    /** The words. */
    readonly text: string
    /** Pictures the node holds the address of (a QR a tool answered, a photo), each with its caption. */
    readonly images?: ReadonlyArray<SentImage> | undefined
    /** The card of the order the message is about (code only: the model never writes one). */
    readonly order?: LineOrder | undefined
    /** The person (the core contact). Absent: the person the run serves. */
    readonly contactId?: string | undefined
    /** The channel, when the person has more than one. Absent: the route the run was woken on. */
    readonly channel?: string | undefined
    /** The connection (account), when the person has several on one channel. */
    readonly accountId?: string | undefined
}

/** What a chatbot node adds: its OWN conversation. Present only in a node of the chatbot agent, which owns the chat record. */
export interface SayChat {
    /** The chatbot's own conversation id (the hear step's output). */
    readonly conversationId: string
}

/** How a call is made. */
export interface SayOptions {
    /** A chatbot node passes its conversation: it marks its chat answered after a delivery. Any other agent passes none and writes NO chatbot record. */
    readonly chat?: SayChat | undefined
}

/** What the engine's send answered when it delivered (or tried): the receipt. */
export interface SayReceipt {
    /** How the delivery ended: the provider took it, the engine refused it, or the outcome is ambiguous. */
    readonly state: "delivered" | "refused" | "unknown"
    /** The refusal code when it was refused; null otherwise. */
    readonly reason: string | null
    /** The once-key of the send: the engine keeps the line under it. */
    readonly sendKey: string
    /** The id the provider gave the message, or null. */
    readonly providerMessageId: string | null
    /** When the engine heard the provider's answer, ISO, or null. */
    readonly at: string | null
}

/** The result of one say: the facts and the receipt the send answered, or why it was not sent. */
export type SayResult =
    | { readonly ok: true; readonly facts: JsonObject; readonly receipt: SayReceipt }
    | { readonly ok: false; readonly refusal: string; readonly facts: JsonObject; readonly declined: boolean }

/** The context a say needs: the tools, the end of the node, the run's instant. */
export type SayContext = Pick<NodeContext, "tools" | "fail" | "run" | "workspace">

/** The receipt the engine's send answers (`CustomerMessageReceipt`: a send is never lost, it states how it ended). */
const receiptSchema = z.object({
    state: z.enum(["delivered", "refused", "unknown"]),
    reason: z.string().max(MAX_ID).nullish(),
    sendKey: z.string().min(1).max(MAX_ID),
    providerMessageId: z.string().max(MAX_ID).nullish(),
    at: z.string().max(MAX_ID).nullish(),
})

/** The payload that addresses the person: the contact (absent: the one the run serves), the channel and the account when named. */
const personPayloadOf = (input: SayInput): JsonObject => ({
    ...(input.contactId === undefined ? {} : { contactId: input.contactId }),
    ...(input.channel === undefined ? {} : { channel: input.channel }),
    ...(input.accountId === undefined ? {} : { accountId: input.accountId }),
    text: input.text,
    ...(input.images === undefined ? {} : { images: input.images.map((image) => ({ url: image.url, caption: image.caption })) }),
    ...(input.order === undefined ? {} : { order: asJson(input.order) }),
})

/**
 * The chatbot's own marks after a delivered reply: the chat is answered (`unanswered` cleared) and its activity stamp (`lastAt`, the inbox
 * order) moves to the delivery. One write; best effort: a writer that moved the record first (a newer line) keeps its marks.
 */
const markAnswered = async (context: SayContext, chat: SayChat, receipt: SayReceipt): Promise<void> => {
    const entities = entitiesOverRecordTools(context)
    const row = await entities.get(CHATBOT_CHAT_ENTITY, chat.conversationId)
    if (row === null) return
    await entities.update(CHATBOT_CHAT_ENTITY, row.id, row.version, { unanswered: false, lastAt: receipt.at ?? context.run.at })
}

/**
 * The ONE way a node tells the customer something (`nivo.tool.customer.message.send`, addressed to the PERSON; the engine keeps the line
 * and answers a receipt). Who holds the thread is the ENGINE's staff hold on the route: the send door refuses every AI send to a held route
 * (`route_held`, ruling R43), so no node checks a holder. In a chatbot node (`options.chat`), after a delivered receipt, it marks its own
 * chat answered; it writes no line (the conversation is the engine's, ruling R26). A node of any other agent only sends (R8). A refusal or a declined approval is answered,
 * never thrown: the node decides.
 */
export const sayToCustomer = async (context: SayContext, input: SayInput, options: SayOptions = {}): Promise<SayResult> => {
    const chat = options.chat
    const answer = await context.tools.call(TOOL.customerMessageSend, personPayloadOf(input))
    if (!answer.ok) {
        if (answer.declined === true) return { ok: false, refusal: "declined", facts: answer.facts, declined: true }
        return { ok: false, refusal: answer.refusal, facts: answer.facts, declined: false }
    }
    const parsed = receiptSchema.safeParse(answer.value)
    if (!parsed.success) return context.fail({ kind: "cannot", why: `${TOOL.customerMessageSend} answered no receipt` }, answer.value)
    const receipt: SayReceipt = {
        state: parsed.data.state,
        reason: parsed.data.reason ?? null,
        sendKey: parsed.data.sendKey,
        providerMessageId: parsed.data.providerMessageId ?? null,
        at: parsed.data.at ?? null,
    }
    if (chat !== undefined && receipt.state === "delivered") await markAnswered(context, chat, receipt)
    return { ok: true, facts: answer.value, receipt }
}

/**
 * The node's stop on a refusal, as `valueOrCannot` ends it on a tool's: the same words (`<tool> refused: <code>`), the facts beside. A
 * declined approval is the node's own branch (read `said.declined` first); an ok answer returns its facts.
 */
export const saidOrCannot = (context: Pick<NodeContext, "fail">, said: SayResult): JsonObject => {
    if (said.ok) return said.facts
    return context.fail({ kind: "cannot", why: `${TOOL.customerMessageSend} refused: ${said.refusal}` }, said.facts)
}
