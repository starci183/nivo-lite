import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { NodeContext } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { valueOrCannot } from "../tool-answers"
import { MESSAGE_READ_LIMIT, THREAD_LINES_MAX } from "./front-desk.policy"

/**
 * The ONE reader of a conversation's thread (NODES-LEAD consolidation 2026-11-12): the Chatbot steps and the Sales consult read the
 * thread through `nivo.tool.conversation.message.list` here, and nowhere else. A thread row is `{ role, text, at, files? }`
 * (ASSUMPTIONS-A T1 as amended: `files` is the pictures and files of the line, absent when it has none).
 */

const LINE_MAX = 300
const URL_MAX = 2000

/** A file of a thread line, as the conversation read answers it; a file the shop could not keep has no address. */
export interface ThreadFile {
    /** The address the model host can fetch, or null when the file was not kept. */
    readonly url: string | null
    /** Its type (`image/jpeg`). */
    readonly contentType: string
}

/** A line of the conversation, as `nivo.tool.conversation.message.list` answers it. */
export interface ThreadFact {
    /** Who wrote it: the customer (`user`), the shop (`agent`) or the system. */
    readonly role: string
    /** What was written. */
    readonly text: string
    /** When it was written, ISO; lines are ordered by it. */
    readonly at: string
    /** The pictures and files sent with the line, or absent when none. */
    readonly files?: ReadonlyArray<ThreadFile> | undefined
}

/** The members of a conversation read's answer a step reads: the lines, newest first. */
const threadAnswer = z.object({
    facts: z.array(
        z.looseObject({
            role: z.string().max(MAX_ID),
            text: z.string(),
            at: z.string().max(MAX_ID),
            files: z
                .array(z.object({ url: z.string().max(URL_MAX).nullable(), contentType: z.string().max(MAX_ID) }))
                .optional(),
        }),
    ),
})

/** The members of a lead order read's answer the front desk reads (ASSUMPTIONS-A, T2): the orders, newest first, by their code. */
const ordersAnswer = z.object({ facts: z.array(z.looseObject({ orderNo: z.string().max(MAX_ID).nullable() })) })

/**
 * The last lines of a conversation, oldest first, each tagged with who said it; system lines and empty lines are left out. A format
 * step only: the role is a field of the record, compared exactly, never a word of the text.
 */
export const threadLinesOf = (facts: ReadonlyArray<ThreadFact>): ReadonlyArray<string> =>
    facts
        .filter((fact) => (fact.role === "user" || fact.role === "agent") && fact.text.trim() !== "")
        .toSorted((left, right) => left.at.localeCompare(right.at))
        .slice(-THREAD_LINES_MAX)
        .map((fact) => `${fact.role === "user" ? "customer" : "shop"}: ${fact.text.trim().slice(0, LINE_MAX)}`)

/** How much of the conversation a read takes: at most `limit` lines, and only those said from `since` on (ISO; null: the whole route). */
export interface ThreadWindow {
    /** The most lines. */
    readonly limit?: number | undefined
    /** The chatbot's chat window (`startedAt`): after a Telegram `/start` the model is never handed the earlier visit. */
    readonly since?: string | null | undefined
}

/**
 * The rows of the conversation the run serves, as the engine's read answers them (newest first, both directions, every agent's). The
 * read takes no conversation id (the engine locks it to the run's own route). A refusal means the run serves no conversation: the step
 * cannot work, and says so.
 */
export const threadRowsOf = async (context: NodeContext, window: ThreadWindow = {}): Promise<ReadonlyArray<ThreadFact>> => {
    const since = window.since ?? null
    const read = valueOrCannot(
        context,
        TOOL.conversationMessageList,
        await context.tools.call(TOOL.conversationMessageList, { limit: window.limit ?? MESSAGE_READ_LIMIT, ...(since === null ? {} : { since }) }),
    )
    return threadAnswer.parse(read).facts
}

/** The recent thread of the conversation the run serves, as the lines the model is shown. */
export const threadOf = async (context: NodeContext, window: ThreadWindow = {}): Promise<ReadonlyArray<string>> =>
    threadLinesOf(await threadRowsOf(context, window))

/**
 * The code of the last order of the customer the run serves, or null when the customer has none or the run serves no known customer
 * (the read refuses). It replaces today's `lead.lastOrderCode` ref (lead memory), which the contract's `ref` cannot name. A hint for
 * the model only: no branch of code depends on it.
 */
export const lastOrderCodeOf = async (context: NodeContext): Promise<string | null> => {
    const read = await context.tools.call(TOOL.leadOrderList, { limit: 1 })
    if (!read.ok) return null
    return ordersAnswer.parse(read.value).facts[0]?.orderNo ?? null
}

/** The most recent lines a front-door step hands on to the workflow it calls. */
export const RECENT_LINES_MAX: number = MESSAGE_READ_LIMIT

/** One recent line as a hand-off carries it (`recentLines`): who wrote it, the words, when, and its pictures and files. */
export const threadFactSchema: z.ZodType<ThreadFact, ThreadFact> = z.object({
    role: z.string().max(MAX_ID),
    text: z.string().max(LINE_MAX * 30),
    at: z.string().max(MAX_ID),
    files: z
        .array(z.object({ url: z.string().max(URL_MAX).nullable(), contentType: z.string().max(MAX_ID) }))
        .max(RECENT_LINES_MAX)
        .optional(),
})

/** The recent lines a hand-off carries: at most `RECENT_LINES_MAX`, each of them `threadFactSchema`. */
export const recentLinesSchema: z.ZodType<ReadonlyArray<ThreadFact>, ReadonlyArray<ThreadFact>> = z.array(threadFactSchema).max(RECENT_LINES_MAX)

/**
 * The recent lines of the conversation a front door hands on (`recentLines`): the customer's and the shop's, oldest first, a line with
 * words or with pictures, at most `RECENT_LINES_MAX`. The callee reads them instead of the conversation (the conversation read is the
 * owning agent's). A format step only: the role is a field of the record, compared exactly.
 */
export const recentLinesOf = (facts: ReadonlyArray<ThreadFact>): ReadonlyArray<ThreadFact> =>
    facts
        .filter((fact) => (fact.role === "user" || fact.role === "agent") && (fact.text.trim() !== "" || (fact.files ?? []).length > 0))
        .toSorted((left, right) => left.at.localeCompare(right.at))
        .slice(-RECENT_LINES_MAX)
        .map((fact) => ({
            role: fact.role,
            text: fact.text,
            at: fact.at,
            ...(fact.files === undefined ? {} : { files: fact.files.map((file) => ({ url: file.url, contentType: file.contentType })) }),
        }))
