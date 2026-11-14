import type { Bilingual } from "@nivo-lite/agent-sdk/module"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"

/** The longest customer message a talk round reads (the front door's own bound, `desk-shapes` TEXT_MAX). */
const TEXT_MAX = 8000

type NoParams = Record<string, never>

/**
 * The two places a round's message can come from: the hand-off (round 1: the words and the front door's summary the caller handed on)
 * and the round's own (later rounds: the message the round's wait took and the summary the round's front-door judgement wrote).
 */
export interface RoundMessageInput {
    /** The words the front door handed the conversation on with (`trigger.data.text`). */
    readonly handed: string
    /** The front door's one line the hand-off carried; null when it carried none. */
    readonly handedSummary: string | null
    /** The words of the message this round's wait took; null in round 1, which waits for nothing. */
    readonly latest: string | null
    /** The one line the round's front-door judgement wrote of that message; null in round 1. */
    readonly latestSummary: string | null
}

/** The input as a graph binds it: the two summaries may be absent. */
export interface RoundMessageInputGiven {
    readonly handed: string
    readonly handedSummary?: string | null | undefined
    readonly latest: string | null
    readonly latestSummary?: string | null | undefined
}

/** The message the round answers, with the front door's line about it. */
export interface RoundMessageOutput {
    /** The words the round's steps read. */
    readonly text: string
    /** The front door's one line about those words; null when none was written. */
    readonly summary: string | null
}

const params: z.ZodType<NoParams> = z.strictObject({})
const input: z.ZodType<RoundMessageInput, RoundMessageInputGiven> = z.object({
    handed: z.string().min(1).max(TEXT_MAX),
    handedSummary: z.string().max(TEXT_MAX).nullable().default(null),
    latest: z.string().min(1).max(TEXT_MAX).nullable(),
    latestSummary: z.string().max(TEXT_MAX).nullable().default(null),
})
const output: z.ZodType<RoundMessageOutput> = z.object({
    text: z.string().min(1).max(TEXT_MAX).describe("The words of the message this round of the talk answers."),
    summary: z.string().max(TEXT_MAX).nullable().describe("The front door's one line about those words; null when none was written."),
})

/** The node a module gets from the factory (named, so each module's constant states its type). */
export type RoundMessageNode = TemplateNode<typeof input, typeof output, typeof params>

/** What a module hands the factory: its key (the node's id prefix) and the step's title in its words. */
export interface RoundMessageConfig {
    readonly module: string
    readonly title: Bilingual
}

/**
 * `<module>.round-message` (the message of the round): the first step of a round of a ONE-RUN conversation (the talk loops of
 * `websales.enquiry` v8 and `webrenew.answer` v14, owner's rule "a conversation is one run"). It answers the words the round's steps
 * read: the message this round's wait took, or in round 1 (no wait ran: the front door's hand-off IS the first message) the handed
 * words. A plain choice between two facts the step is given: no AI, no tool, no reading of meaning. One shared piece (a factory, as
 * the team-answer is), one id per module so each agent's set holds its own step.
 */
export const roundMessageNodeOf = (config: RoundMessageConfig): RoundMessageNode =>
    defineTemplateNode({
        id: `${config.module}.round-message`,
        title: config.title,
        description: {
            vi: "Lấy tin nhắn của lượt này trong cuộc trò chuyện: tin khách vừa gửi, hoặc ở lượt đầu là lời Lễ tân chuyển sang.",
            en: "Takes the message this round of the conversation answers: the one the customer just sent, or in the first round the words the front door handed on.",
        },
        tools: [],
        mode: "auto",
        accounts: [],
        params,
        input,
        output,
        run: (given) =>
            Promise.resolve(
                given.latest === null
                    ? { text: given.handed, summary: given.handedSummary }
                    : { text: given.latest, summary: given.latestSummary },
            ),
        examples: [
            {
                name: "round 1: no wait ran, the round answers the words the front door handed on",
                params: {},
                input: { handed: "Ben em lam web ban hang gia sao", handedSummary: "Khach hoi gia web ban hang.", latest: null },
                output: { text: "Ben em lam web ban hang gia sao", summary: "Khach hoi gia web ban hang." },
            },
            {
                name: "a later round: the round answers the message its wait took",
                params: {},
                input: {
                    handed: "Ben em lam web ban hang gia sao",
                    handedSummary: "Khach hoi gia web ban hang.",
                    latest: "Shop quan ao, khoang 50 san pham",
                    latestSummary: "Khach mo ta shop quan ao 50 san pham.",
                },
                output: { text: "Shop quan ao, khoang 50 san pham", summary: "Khach mo ta shop quan ao 50 san pham." },
            },
        ],
    })
