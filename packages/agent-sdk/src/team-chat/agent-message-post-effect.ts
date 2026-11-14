import { TOOL } from "../names/tool"
import { defineEffect } from "../node/effect"
import type { EffectDefinition } from "../node/effect.types"
import { z } from "../schema/zod-entry"
import { TEAM_TEXT_MAX, type TeamAudience, type TeamChatAnswer, type TeamText } from "./team-messages"

/** The longest id, line and body a payload of the team post accepts. */
const ID_MAX = 200
const LINE_MAX = 500

/** The record a finished card is about, with where it opens. */
export interface TeamCardWork {
    /** The record's words in the reader's language. */
    readonly label: string
    /** Where the record opens. */
    readonly href: string
}

/**
 * A card the package built, finished: the kind it registered (`messageKinds` of its plugin), what it is for, the heading, the one line
 * the chat shows where no card is drawn and the content in the shape the kind declares. The engine checks the content against the schema of
 * the registered kind and stores and delivers it as it is; it reads nothing else of it. A kind the installation does not list is refused.
 */
export interface TeamCardPost {
    /** The registered kind of the content (never `message.text` or `chat.answer`, which have their own members). */
    readonly kind: string
    /** What the message is for. */
    readonly intent: "notify" | "ask" | "report"
    /** The heading. */
    readonly title: string
    /** The one line the chat shows where no card is drawn. */
    readonly summary: string
    /** The content, in the shape the kind declares. */
    readonly payload: object
    /** The record the message is about, with where it opens. */
    readonly work?: TeamCardWork | undefined
    /** Who reads it; the founder when absent. */
    readonly audience?: TeamAudience | undefined
}

/** What a MODEL may say to the team in the chat: plain words, or an answer to a person's message. Never a card: no model types an amount. */
export type AgentMessageModelPayload = TeamText | TeamChatAnswer

/** What package CODE may post to the team in the chat: the model's words and answers, or a finished card of a registered kind. */
export type AgentMessagePostPayload = AgentMessageModelPayload | TeamCardPost

const id = z.string().min(1).max(ID_MAX)
const line = z.string().min(1).max(LINE_MAX)

const audience = z
    .enum(["founder", "own", "everyone"])
    .optional()
    .describe(
        "Every line reaches the owner in your private chat. Audience adds a group: own (also post it in your team's room), everyone (also post it in the whole shop's room), founder (the owner alone). A group only receives it when you hold the right to post there; the answer says where it went.",
    )

/** The kinds that have a member of their own: a card never names them. */
const OWN_KINDS: ReadonlySet<string> = new Set(["message.text", "chat.answer"])

const textMember = z.object({
    kind: z.literal("message.text"),
    intent: z.enum(["notify", "ask", "report"]).describe("What the message is for: tell, ask, or report."),
    title: line.describe("The heading."),
    text: z
        .string()
        .min(1)
        .max(TEAM_TEXT_MAX)
        .describe("The words. Quote an amount only as a tool or the customer gave it."),
    audience,
})

const answerMember = z.object({
    kind: z.literal("chat.answer"),
    messageId: id.describe(
        "The person's message in the shop chat you answer: the answer is posted in its room as a reply to it.",
    ),
    text: z
        .string()
        .min(1)
        .max(TEAM_TEXT_MAX)
        .describe("The answer. The team chat step posts it for you: do not call this kind yourself."),
})

const cardMember = z.object({
    kind: z
        .string()
        .min(1)
        .max(ID_MAX)
        .refine((kind) => !OWN_KINDS.has(kind))
        .describe("The registered kind of a finished card a package's step built."),
    intent: z.enum(["notify", "ask", "report"]).describe("What the card is for."),
    title: line.describe("The heading."),
    summary: z.string().max(TEAM_TEXT_MAX).describe("The one line the chat shows where no card is drawn."),
    payload: z.record(z.string().max(ID_MAX), z.unknown()).describe("The content, in the shape its kind declares."),
    work: z.object({ label: z.string().max(LINE_MAX), href: z.string().max(LINE_MAX) }).optional(),
    audience,
})

/** The shape of a MODEL's call: plain words or an answer, never a card (the effect's `payload`, which is what the model is shown and checked against). */
const agentMessageModelPayload: z.ZodType<AgentMessageModelPayload> = z
    .union([textMember, answerMember])
    .describe("Tell the team in the shop's internal chat (never the customer) in plain words (message.text).")

/** The shape package CODE posts (the effect's `codePayload`): the model's members and a finished card a step built from its records. */
export const agentMessageCodePayload: z.ZodType<AgentMessagePostPayload> = z
    .union([textMember, answerMember, cardMember])
    .describe(
        "Tell the team in the shop's internal chat (never the customer). Plain words use message.text; a card is a finished one a step built from the records, of a kind the installation registers.",
    )

/**
 * Says something to the owner in the agent's own chat and in the team chat: a message of a registered kind with an intent. Once per
 * dedupe key across runs; the subject is the chat message. The tool of `nivo.tool.team.message.post`; a package lists it in its `effects`
 * (the core package does) and its title words come from the package.
 */
export const agentMessagePostEffect: EffectDefinition<z.ZodType<AgentMessageModelPayload>> = defineEffect({
    id: TOOL.teamMessagePost,
    title: { key: "effectAgentMessagePost" },
    payload: agentMessageModelPayload,
    codePayload: agentMessageCodePayload,
})
