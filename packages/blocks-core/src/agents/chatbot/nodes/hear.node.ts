import { type ScriptedToolCall, type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { bilingualOf } from "../../../shared/messages/catalog"
import { entitiesOverRecordTools } from "../../../shared/customer-chat/record-tools.entities"
import { hearOver, type HeardLine, type HearRoute } from "../tools/hear"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered } from "../../../shared/nodes/tool-answers"
import { type ThreadFact, threadRowsOf, unreadLinesOf } from "../../../shared/customer-chat/front-desk.reads"
import { TEXT_MAX, channelDataSchema, heardSubjectSchema, lineOfScope, queuedLinesOf } from "./queued-lines"

type NoParams = Record<string, never>

/** A file that came with the message, as the channel's data holds it (a picture the shop kept). */
interface HearFile {
    readonly id: string
    readonly url: string
    readonly name: string
    readonly contentType: string
}

/** The person the event is about, as its subject names them: the channel, the channel's own id of the person, the name it shows. */
export interface HearSubject {
    readonly channel: string
    readonly id: string
    readonly name?: string | null | undefined
}

/** The data of a channel message (ROAD-API 3.2): one event is one line. */
export interface HearData {
    /** The channel's own id of the message: the key the line is stored once under; empty on the release door's resume. */
    readonly messageKey?: string | null | undefined
    /** What the person said. */
    readonly text?: string | undefined
    /** When the channel says it was sent, ISO. */
    readonly at?: string | null | undefined
    /** The pictures and files that came with it. */
    readonly files?: ReadonlyArray<HearFile> | null | undefined
    /** `held` on the release door's event (a person released the conversation): no words, the unanswered lines are read again. */
    readonly resume?: string | null | undefined
}

/**
 * What the front desk wakes with: the GENERIC members of the trigger scope (ROAD-API 3.1; no chat member): the route, the contact and the
 * account the engine met the person on, the event's subject (who the person is on the channel) and the event's data (its one line). The other
 * lines of a burst come as the run's queue (`ctx.run.queue`), which this step reads itself.
 */
export interface HearNodeInput {
    /** The route the engine ensured for the person on the account: the chat is the route's live chat. */
    readonly routeId?: string | null | undefined
    /** The core contact the person is. */
    readonly contactId?: string | null | undefined
    /** Who the person is on the channel; absent on the release door's event. */
    readonly subject?: HearSubject | null | undefined
    /** The event's data. */
    readonly data: HearData
}

/** What the next steps read of the hearing. */
export interface HearOutput {
    /** The route the run takes: answer (words, pictures, or a fresh visit with neither), or nothing to answer. */
    readonly route: HearRoute
    /** The chatbot's own conversation (its records' id); empty when the run ends before any. */
    readonly conversationId: string
    /** The channel of the conversation; empty when the run ends before any. */
    readonly channel: string
    /** What the person said: the lines heard (the event's and the queued ones), or on a resume the lines no reply followed; empty for pictures only or a fresh visit. */
    readonly text: string
    /** Where the chat's window on the route's lines starts (ISO), or null: the `since` the chatbot's later steps read the thread from. */
    readonly startedAt: string | null
    /** Each line heard with its pictures (what `understand` shows the model), in order. */
    readonly messages: ReadonlyArray<HeardMessage>
}

/** One line heard, as the understand step reads it: its words and its attachments. */
export interface HeardMessage {
    readonly text: string
    readonly attachments: ReadonlyArray<{ readonly name: string; readonly contentType: string; readonly url: string }>
}

/** The most lines heard one run hands on. */
const HEARD_MAX = 100

const params: NodeSchema<NoParams> = z.strictObject({})
const optionalId = z.string().min(1).max(MAX_ID).nullish()
const input: NodeSchema<HearNodeInput> = z.object({
    routeId: optionalId,
    contactId: optionalId,
    subject: heardSubjectSchema.nullish(),
    data: channelDataSchema,
})
const output: NodeSchema<HearOutput> = z.object({
    route: z.enum(["go", "nothing"]).describe("go: answer the person (words, pictures, or a /start with neither); nothing: nothing to answer"),
    conversationId: z.string().max(MAX_ID).describe("The chatbot's own conversation id; empty when the run ends before any."),
    channel: z.string().max(MAX_ID).describe("The channel of the conversation; empty when the run ends before any."),
    text: z.string().max(TEXT_MAX).describe("What the person said."),
    startedAt: z.string().max(MAX_ID).nullable().describe("Where the chat's window on the route's lines starts (ISO), or null."),
    messages: z
        .array(
            z.object({
                text: z.string().max(TEXT_MAX),
                attachments: z.array(z.object({ name: z.string().max(MAX_ID), contentType: z.string().max(MAX_ID), url: z.string().max(2000) })).max(20),
            }),
        )
        .max(HEARD_MAX)
        .describe("Each line heard with its pictures, in order."),
})

const CHAT = "chat-1"
/** The route the engine ensured for the person: the event names it, the chat carries it. */
const ROUTE = "route-1"
const STAMP = "2026-11-13T02:00:00.000Z"
const CHAT_VALUES: JsonObject = {
    channel: "zalo",
    contactId: "contact-1",
    routeId: ROUTE,
    name: "Lan",
    startedAt: STAMP,
}
const record = (values: JsonObject): JsonObject => ({ id: CHAT, version: "1", createdAt: STAMP, updatedAt: STAMP, values })
const page = (values: JsonObject): JsonObject => ({ records: [record(values)], next: null })
/** The event of the examples: a Zalo line (the engine kept it at delivery). */
const EVENT: HearNodeInput = {
    routeId: ROUTE,
    contactId: "contact-1",
    subject: { channel: "zalo", id: "u-1" },
    data: { messageKey: "zalo:conn-1:m1", text: "How much are the roses", at: STAMP, files: [] },
}
/** A picture the person sent, as the conversation read answers its address. */
const ROSE = "https://files.example/rose.jpg"
/** The conversation read of an example: the lines newest first, as the engine answers them. */
const threadOf = (facts: ReadonlyArray<JsonObject>): ScriptedToolCall => ({
    id: TOOL.conversationMessageList,
    answer: answered({ notice: "", source: "nivo.conversation", asOf: STAMP, facts: [...facts] }),
})
const MARKED = { id: TOOL.recordUpdate, answer: answered({ record: record({ ...CHAT_VALUES, unanswered: true, lastAt: STAMP }) }) }

/**
 * The person's lines after the shop's last line, oldest first, each with its words and pictures, as the hear step takes them (by role, never
 * by words; the thread read answers newest first). The thread names no message key (the engine kept the line) and a file it could not keep
 * has no address: it is handed with an empty one, so the model host tells the model it came unseen.
 */
const unreadOf = (rows: ReadonlyArray<ThreadFact>): ReadonlyArray<HeardLine> =>
    unreadLinesOf(rows).map((row) => ({
        messageKey: "",
        text: row.text,
        at: row.at,
        files: (row.files ?? []).map((file) => ({ id: "", url: file.url ?? "", name: "", contentType: file.contentType })),
    }))

/**
 * `chatbot.hear` (the front desk's first step): plain code over the chatbot's OWN records, scope = the chatbot agent (nivo-toolset
 * "records": the default record tools). It reads the event's own line (the generic trigger scope: route, contact, account, subject, data) and
 * the lines queued on the run (`ctx.run.queue`: the rest of a burst, oldest first), finds or opens the route's live chat, stores NO
 * line (the engine kept each at delivery, R26) and marks the chat unanswered. Who holds the thread is not read here: a staff hold is the
 * ENGINE's (the route's), and the engine's send door refuses every AI send to a held route (`route_held`, ruling R43). Telegram's bot command `/start` (Telegram only: the text of a Telegram message, trimmed, starts with `/start`, the channel's
 * own command format, as the Telegram intake tested it before the one pipeline) archives the conversation and opens a fresh visit; with no
 * words after it the run goes on with none (`go`, empty text) and the model greets: no customer text is coded (ruling R45). What the run
 * HEARS is the person's lines after the shop's last one in the chat's window, read from the engine's conversation (`since` the chat's
 * start, by role), each with its pictures: the engine may wake the run once for several lines (R73), and a `resume` (the release door's
 * event: a person released the thread) carries none of its own. The event's line and the queued ones stand only when the conversation
 * shows nothing unread. It calls no model.
 */
export const chatbotHearNode: TemplateNode<
    NodeSchema<HearNodeInput>,
    NodeSchema<HearOutput>,
    NodeSchema<NoParams>,
    HearRoute
> = defineTemplateNode({
    id: "chatbot.hear",
    title: bilingualOf("nodeChatbotHearTitle"),
    description: {
        vi: "Tìm cuộc trò chuyện của khách, đánh dấu tin chưa trả lời, rồi chuyển lời khách cho bước sau. Khi người của tiệm đang giữ cuộc trò chuyện, hệ thống chặn mọi tin AI gửi.",
        en: "Finds the customer's conversation, marks it unanswered, then hands the words on. While a person of the shop holds the thread, the engine refuses every AI send.",
    },
    tools: [TOOL.conversationMessageList],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    routes: { by: "route", names: ["go", "nothing"] },
    run: async (given, context) => {
        const heard = await hearOver(
            entitiesOverRecordTools(context),
            {
                workspaceId: "",
                memberId: null,
                now: new Date(context.run.at),
                timeZone: context.workspace.timeZone,
                locale: "vi",
            },
            {
                routeId: given.routeId,
                contactId: given.contactId,
                line: lineOfScope(given.subject, given.data),
                queued: queuedLinesOf(context.run.queue),
                resume: given.data.resume,
                unreadSince: async (since) => unreadOf(await threadRowsOf(context, { since })),
            },
        )
        // A person said something and no conversation holds them: this step cannot open one (it cannot name the speaking agent, lane
        // STOP). The engine's one failure path reports it; the line is never dropped quietly.
        if (heard.unopened)
            context.fail({ kind: "cannot", why: "no conversation holds this person and the hear step cannot open one: the run's agent is not named to it" })
        return {
            route: heard.route,
            conversationId: heard.conversationId ?? "",
            channel: heard.channel,
            text: heard.text,
            startedAt: heard.startedAt,
            messages: heard.lines.slice(0, HEARD_MAX).map((line) => ({
                text: line.text,
                attachments: (line.files ?? []).map((one) => ({ name: one.name, contentType: one.contentType, url: one.url })),
            })),
        }
    },
    examples: [
        {
            name: "a person's line: the route's live chat is found and marked unanswered; no line is written (the engine kept it)",
            params: {},
            input: EVENT,
            tools: [{ id: TOOL.recordList, answer: answered(page(CHAT_VALUES)) }, MARKED, threadOf([{ role: "user", text: "How much are the roses", at: STAMP }])],
            output: { route: "go", conversationId: CHAT, channel: "zalo", text: "How much are the roses", startedAt: STAMP, messages: [{ text: "How much are the roses", attachments: [] }] },
        },
        {
            // ONE wake for several lines (R73): the event carries the oldest; the others, a picture among them, are read from the thread.
            name: "several lines since the shop's last one are heard together from the conversation, pictures included, whatever line woke the run",
            params: {},
            input: EVENT,
            tools: [
                { id: TOOL.recordList, answer: answered(page(CHAT_VALUES)) },
                MARKED,
                threadOf([
                    { role: "user", text: "Is it fresh?", at: "2026-11-13T02:03:00.000Z" },
                    { role: "user", text: "", at: "2026-11-13T02:02:00.000Z", files: [{ url: ROSE, contentType: "image/jpeg" }] },
                    { role: "user", text: "Like this one", at: "2026-11-13T02:01:00.000Z" },
                    { role: "user", text: "How much are the roses", at: STAMP },
                    { role: "agent", text: "We open at 8", at: "2026-11-13T01:00:00.000Z" },
                ]),
            ],
            output: {
                route: "go",
                conversationId: CHAT,
                channel: "zalo",
                text: "How much are the roses\nLike this one\nIs it fresh?",
                startedAt: STAMP,
                messages: [
                    { text: "How much are the roses", attachments: [] },
                    { text: "Like this one", attachments: [] },
                    { text: "", attachments: [{ name: "", contentType: "image/jpeg", url: ROSE }] },
                    { text: "Is it fresh?", attachments: [] },
                ],
            },
        },
        {
            // The node's own code reads the conversation here (`threadRowsOf`): the reason `tools` lists the default read.
            name: "a resume (the release door's event): the person's lines after the shop's last one are read from the conversation by role; no mark is written",
            params: {},
            input: { routeId: ROUTE, contactId: "contact-1", subject: null, data: { messageKey: null, text: "", at: null, files: [], resume: "held" } },
            tools: [
                { id: TOOL.recordList, answer: answered(page(CHAT_VALUES)) },
                threadOf([
                    { role: "user", text: "Still there?", at: "2026-11-13T02:50:00.000Z" },
                    { role: "user", text: "Hello", at: "2026-11-13T02:40:00.000Z" },
                    { role: "agent", text: "We open at 8", at: "2026-11-13T02:30:00.000Z" },
                ]),
            ],
            output: {
                route: "go",
                conversationId: CHAT,
                channel: "zalo",
                text: "Hello\nStill there?",
                startedAt: STAMP,
                // The lines heard on a resume are handed on with their pictures, as every line heard is (QUEUE-DESIGN (5)).
                messages: [
                    { text: "Hello", attachments: [] },
                    { text: "Still there?", attachments: [] },
                ],
            },
        },
    ],
})
