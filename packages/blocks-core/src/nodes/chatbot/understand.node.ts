import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"
import { frontDeskSample } from "./front-desk.copy"
import { COMPLAINT_THREAD, lastOrderRead, threadRead } from "./front-desk.fixtures"
import { UNDERSTAND_GOAL } from "./front-desk.policy"
import { type ThreadFact, lastOrderCodeOf, threadFactSchema, recentLinesOf, recentLinesSchema, threadLinesOf, threadRowsOf } from "./front-desk.reads"

type NoParams = Record<string, never>

/** What the customer wants now: the five routes of the front desk. */
export type UnderstandBranch = "buy" | "book" | "paid" | "complaint" | "question"

/** A file the customer sent with a message, as the channel trigger carries it. */
export interface UnderstandFile {
    /** Its name. */
    readonly name: string
    /** Its type (`image/jpeg`). */
    readonly contentType: string
    /** A short-lived address the model host can fetch. */
    readonly url: string
}

/** One customer message of the burst with the files sent with it. */
export interface UnderstandMessage {
    /** What the customer said. */
    readonly text: string
    /** The files sent with it. */
    readonly attachments: ReadonlyArray<UnderstandFile>
}

/**
 * What the decision reads: the new words and the pictures sent with them. The thread and the last order are read by the step through
 * the context reads, which the engine locks to the run's own conversation and customer (so no conversation id is taken).
 */
export interface UnderstandInput {
    /** What the customer said, one message per line; empty for a line with only pictures, or a fresh visit (`/start`) with no words. */
    readonly text: string
    /** Each message with its files, or null when the trigger carries only the words. */
    readonly messages?: ReadonlyArray<UnderstandMessage> | null | undefined
    /** The chat's window on the route's lines (`chatbot.hear`'s `startedAt`): the thread is read from then on; null: the whole route. */
    readonly since?: string | null | undefined
}

/** The route the graph takes and the one line that says why. */
export interface UnderstandOutput {
    /** The route: to buy, to book an appointment, a transfer the customer reports, a complaint, or a question. */
    readonly branch: UnderstandBranch
    /** One line in Vietnamese saying what the customer wants, for the team and the next workflow. */
    readonly summary: string
    /** The recent lines of the conversation, oldest first, for the workflow the front desk hands on to (it cannot read them itself). */
    readonly recentLines: ReadonlyArray<ThreadFact>
}

/** What the AI decides: the route and the one line why. */
type UnderstandDecision = Omit<UnderstandOutput, "recentLines">

const TEXT_MAX = 8000
const MESSAGES_MAX = 100
const FILES_MAX = 20
const URL_MAX = 2000
/** The most pictures shown to the model in one decision. */
const IMAGES_SHOWN_MAX = 4

const params: NodeSchema<NoParams> = z.strictObject({})
const file: NodeSchema<UnderstandFile> = z.object({
    name: z.string().max(MAX_LINE),
    contentType: z.string().max(MAX_LINE),
    url: z.string().max(URL_MAX),
})
const input: NodeSchema<UnderstandInput> = z.object({
    text: z.string().max(TEXT_MAX),
    messages: z
        .array(z.object({ text: z.string().max(TEXT_MAX), attachments: z.array(file).max(FILES_MAX) }))
        .max(MESSAGES_MAX)
        .nullish(),
    since: z.string().max(40).nullish(),
})
/** The members the AI decides. */
const decisionMembers = {
    branch: z
        .enum(["buy", "book", "paid", "complaint", "question"])
        .describe(
            "buy: wants to buy or asks about a product; book: wants to book, reschedule an appointment, a table or a time slot with the shop; paid: reports a transfer; complaint: unhappy with an order or the service; question: asks about the shop, a greeting included",
        ),
    summary: z.string().min(1).max(MAX_LINE).describe("One line in Vietnamese: what the customer wants, for the team"),
}

const decision: NodeSchema<UnderstandDecision> = z.object(decisionMembers)

const output: NodeSchema<UnderstandOutput> = z.object({
    ...decisionMembers,
    recentLines: recentLinesSchema.describe("The recent lines of the conversation, oldest first, for the workflow it hands on to."),
})

/**
 * The pictures of the burst, by the address the model host fetches. The content type is a field of the trigger, compared by its
 * registered prefix (a format check, not meaning).
 */
const imagesOf = (messages: ReadonlyArray<UnderstandMessage> | null | undefined): ReadonlyArray<string> =>
    (messages ?? [])
        .flatMap((message) => message.attachments)
        .filter((one) => one.contentType.startsWith("image/"))
        .slice(0, IMAGES_SHOWN_MAX)
        .map((one) => one.url)

/** The complaint thread as the hand-off carries it (oldest first). */
const COMPLAINT_LINES = recentLinesOf(COMPLAINT_THREAD.map((line) => threadFactSchema.parse(line))).map((line) => ({ ...line }))

/** The customer's confusion every example of a confused decision scripts. */
const CONFUSED_QUESTION = frontDeskSample("confusedQuestion")

/**
 * `chatbot.understand` (the front desk's "understand the customer"): a pure decision over the customer's new message, the recent
 * conversation and the code of the customer's last order, both read by the step through the context reads. It routes the front desk
 * one of five ways (buy, book, paid, complaint, question) by its output `branch` and says in one line why, and hands on the recent lines
 * (`recentLines`) for the Booking, which reads them instead of the conversation. It writes and stores nothing. No words are required: a line
 * with only pictures is read from its pictures, and a fresh visit with neither is the customer opening the chat (ruling R45). When the AI
 * cannot tell, `agent.run` fails confused by itself and the engine takes over.
 */
export const chatbotUnderstandNode: TemplateNode<
    NodeSchema<UnderstandInput>,
    NodeSchema<UnderstandOutput>,
    NodeSchema<NoParams>,
    UnderstandBranch
> = defineTemplateNode({
    id: "chatbot.understand",
    title: bilingualOf("nodeChatbotUnderstandTitle"),
    description: { vi: "\u0110\u1ecdc tin nh\u1eafn m\u1edbi c\u1ee7a kh\u00e1ch \u0111\u1ec3 hi\u1ec3u kh\u00e1ch c\u1ea7n g\u00ec: mua h\u00e0ng, \u0111\u1eb7t l\u1ecbch, b\u00e1o \u0111\u00e3 chuy\u1ec3n ti\u1ec1n, ph\u00e0n n\u00e0n hay h\u1ecfi th\u00f4ng tin.", en: "Reads the customer's new message to see what they need: buying, booking, a payment report, a complaint or a question." },
    tools: [TOOL.conversationMessageList, TOOL.leadOrderList],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    routes: { by: "branch", names: ["buy", "book", "paid", "complaint", "question"] },
    run: async (given, context) => {
        const rows = await threadRowsOf(context, { since: given.since })
        const lastOrderCode = await lastOrderCodeOf(context)
        const decided = await context.agent.run({
            goal: UNDERSTAND_GOAL,
            input: { message: given.text, conversation: [...threadLinesOf(rows)], lead: { lastOrderCode } },
            output: decision,
            tools: [],
            maxTurns: 1,
            images: imagesOf(given.messages),
        })
        return { ...decided, recentLines: [...recentLinesOf(rows)] }
    },
    examples: [
        {
            name: "a wish to buy goes to the sales consult",
            params: {},
            input: { text: frontDeskSample("muonMuaHoa") },
            tools: [threadRead([]), lastOrderRead(null)],
            agent: [{ answer: { branch: "buy", summary: frontDeskSample("summaryBuy") } }],
            output: { branch: "buy", summary: frontDeskSample("summaryBuy"), recentLines: [] },
        },
        {
            name: "a wish to book an appointment goes to the booking",
            params: {},
            input: { text: frontDeskSample("muonDatLich") },
            tools: [threadRead([]), lastOrderRead(null)],
            agent: [{ answer: { branch: "book", summary: frontDeskSample("summaryBook") } }],
            output: { branch: "book", summary: frontDeskSample("summaryBook"), recentLines: [] },
        },
        {
            name: "a transfer the customer reports goes to reconcile, the last order read as a hint",
            params: {},
            input: { text: frontDeskSample("daChuyen") },
            tools: [threadRead([]), lastOrderRead("DH-102")],
            agent: [{ answer: { branch: "paid", summary: frontDeskSample("summaryPaid") } }],
            output: { branch: "paid", summary: frontDeskSample("summaryPaid"), recentLines: [] },
        },
        {
            name: "a bare order number after the shop asked for it continues the complaint of the thread",
            params: {},
            input: { text: frontDeskSample("maDon") },
            tools: [threadRead(COMPLAINT_THREAD), lastOrderRead(null)],
            agent: [{ answer: { branch: "complaint", summary: frontDeskSample("summaryComplaint") } }],
            output: { branch: "complaint", summary: frontDeskSample("summaryComplaint"), recentLines: COMPLAINT_LINES },
        },
        {
            name: "a greeting is a question the front desk answers",
            params: {},
            input: { text: frontDeskSample("chaoShop") },
            tools: [threadRead([]), lastOrderRead(null)],
            agent: [{ answer: { branch: "question", summary: frontDeskSample("summaryGreeting") } }],
            output: { branch: "question", summary: frontDeskSample("summaryGreeting"), recentLines: [] },
        },
        {
            name: "a line with only a picture needs no words: the model reads the picture (a bouquet the customer wants) and routes buy",
            params: {},
            input: {
                text: "",
                messages: [{ text: "", attachments: [{ name: "bo-hoa.jpg", contentType: "image/jpeg", url: "https://files.example/bo-hoa.jpg" }] }],
            },
            tools: [threadRead([]), lastOrderRead(null)],
            agent: [{ answer: { branch: "buy", summary: frontDeskSample("summaryBuy") } }],
            output: { branch: "buy", summary: frontDeskSample("summaryBuy"), recentLines: [] },
        },
        {
            name: "a fresh visit with no words (Telegram /start) is the customer opening the chat: a greeting the front desk answers",
            params: {},
            input: { text: "", messages: [] },
            tools: [threadRead([]), lastOrderRead(null)],
            agent: [{ answer: { branch: "question", summary: frontDeskSample("summaryGreeting") } }],
            output: { branch: "question", summary: frontDeskSample("summaryGreeting"), recentLines: [] },
        },
        {
            name: "the AI cannot tell: the step ends confused and routes nowhere",
            params: {},
            input: { text: frontDeskSample("maDon") },
            tools: [threadRead([]), lastOrderRead(null)],
            agent: [{ fail: { kind: "confused", question: CONFUSED_QUESTION } }],
            failure: { kind: "confused", question: CONFUSED_QUESTION },
        },
    ],
})
