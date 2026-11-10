import { type NodeDefinition, defineNode } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"
import { frontDeskSample } from "./front-desk.copy"
import { MESSAGE_FIELDS, MESSAGE_READ_LIMIT, UNDERSTAND_INSTRUCTIONS, threadLinesOf, type ThreadRow } from "./front-desk.policy"

type NoParams = Record<string, never>

/** What the customer wants now: the four routes of the front desk. */
export type UnderstandBranch = "buy" | "paid" | "complaint" | "question"

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

/** What the decision reads: the new words, the pictures sent with them, the conversation they belong to and the lead's last order. */
export interface UnderstandInput {
    /** The conversation the message came in. */
    readonly conversationId: string
    /** What the customer said, one message per line. */
    readonly text: string
    /** Each message with its files, or null when the trigger carries only the words. */
    readonly messages?: ReadonlyArray<UnderstandMessage> | null | undefined
    /** The code of the lead's last order, from lead memory, or null when the lead has none. */
    readonly lastOrderCode?: string | null | undefined
}

/** The route the graph takes and the one line that says why. */
export interface UnderstandOutput {
    /** The route: to buy, a transfer the customer reports, a complaint, or a question. */
    readonly branch: UnderstandBranch
    /** One line in Vietnamese saying what the customer wants, for the team and the next workflow. */
    readonly summary: string
}

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
    conversationId: z.string().min(1).max(MAX_ID),
    text: z.string().min(1).max(TEXT_MAX),
    messages: z
        .array(z.object({ text: z.string().max(TEXT_MAX), attachments: z.array(file).max(FILES_MAX) }))
        .max(MESSAGES_MAX)
        .nullish(),
    lastOrderCode: z.string().max(MAX_ID).nullish(),
})
const output: NodeSchema<UnderstandOutput> = z.object({
    branch: z
        .enum(["buy", "paid", "complaint", "question"])
        .describe(
            "buy: wants to buy or asks about a product; paid: reports a transfer; complaint: unhappy with an order or the service; question: asks about the shop, a greeting included",
        ),
    summary: z.string().min(1).max(MAX_LINE).describe("One line in Vietnamese: what the customer wants, for the team"),
})
const GRANT = { rights: [{ kind: "message", access: "read", scope: "turn", fields: [...MESSAGE_FIELDS] }] } as const

/** The pictures of the burst, by the address the model host fetches. */
const imagesOf = (messages: ReadonlyArray<UnderstandMessage> | null | undefined): ReadonlyArray<string> =>
    (messages ?? [])
        .flatMap((message) => message.attachments)
        .filter((one) => one.contentType.startsWith("image/"))
        .slice(0, IMAGES_SHOWN_MAX)
        .map((one) => one.url)

/** A stored line of the example conversation. */
const line = (role: string, text: string, sentAt: string): Readonly<Record<string, string>> => ({
    conversationId: "c1",
    role,
    text,
    sentAt,
    status: "posted",
})

/**
 * `chatbot.understand` (the front desk's "understand the customer"): a pure decision over the customer's new message, the recent conversation and the lead's last order;
 * it routes the front desk one of four ways (buy, paid, complaint, question) and says in one line why. It writes nothing. When the AI
 * cannot tell, the step ends confused and the engine takes over.
 */
export const chatbotUnderstandNode: NodeDefinition<
    NodeSchema<UnderstandInput>,
    NodeSchema<UnderstandOutput>,
    NodeSchema<NoParams>
> = defineNode({
    id: "chatbot.understand",
    role: "condition",
    title: bilingualOf("nodeChatbotUnderstandTitle"),
    params,
    input,
    output,
    rights: [{ kind: "message", access: "read", scope: "turn", fields: [...MESSAGE_FIELDS] }],
    effects: [],
    run: async (given, context) => {
        const rows = await context.data.read<ThreadRow>("message", {
            where: { conversationId: given.conversationId, status: "posted" },
            fields: [...MESSAGE_FIELDS],
            limit: MESSAGE_READ_LIMIT,
        })
        const decision = await context.model.decide(output, {
            purpose: "understand",
            instructions: UNDERSTAND_INSTRUCTIONS,
            input: {
                message: given.text,
                conversation: threadLinesOf(rows),
                lead: { lastOrderCode: given.lastOrderCode ?? null },
            },
            images: imagesOf(given.messages),
        })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        return decision.value
    },
    examples: [
        {
            name: "a wish to buy goes to the sales consult",
            grant: GRANT,
            params: {},
            input: { conversationId: "c1", text: frontDeskSample("muonMuaHoa") },
            model: [{ answer: { branch: "buy", summary: frontDeskSample("summaryBuy") } }],
            output: { branch: "buy", summary: frontDeskSample("summaryBuy") },
            effects: [],
        },
        {
            name: "a transfer the customer reports goes to reconcile",
            grant: GRANT,
            params: {},
            input: { conversationId: "c1", text: frontDeskSample("daChuyen"), lastOrderCode: "DH-102" },
            model: [{ answer: { branch: "paid", summary: frontDeskSample("summaryPaid") } }],
            output: { branch: "paid", summary: frontDeskSample("summaryPaid") },
            effects: [],
        },
        {
            name: "a bare order number after the shop asked for it continues the complaint of the thread",
            grant: GRANT,
            params: {},
            input: { conversationId: "c1", text: frontDeskSample("maDon") },
            store: {
                message: [
                    line("user", frontDeskSample("hoaHeo"), "2026-11-09T10:00:00Z"),
                    line("agent", frontDeskSample("shopAsk"), "2026-11-09T10:01:00Z"),
                ],
            },
            model: [{ answer: { branch: "complaint", summary: frontDeskSample("summaryComplaint") } }],
            output: { branch: "complaint", summary: frontDeskSample("summaryComplaint") },
            effects: [],
        },
        {
            name: "a greeting is a question the front desk answers",
            grant: GRANT,
            params: {},
            input: { conversationId: "c1", text: frontDeskSample("chaoShop") },
            model: [{ answer: { branch: "question", summary: frontDeskSample("summaryGreeting") } }],
            output: { branch: "question", summary: frontDeskSample("summaryGreeting") },
            effects: [],
        },
    ],
})
