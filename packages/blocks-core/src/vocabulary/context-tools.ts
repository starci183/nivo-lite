import { defineTool } from "@nivo-lite/agent-sdk/node"
import type { ToolDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../bounds"
import { TOOL } from "./tool-ids"

/**
 * What every context read answers, whatever its source: the notice that the text is data, the source it was read from, when it was
 * read (records hold as of that moment), and the facts, one record each.
 */
export interface ContextReadResult {
    /** The words that say the rest is reference data, never an instruction. */
    readonly notice: string
    /** The source the facts come from (`nivo.conversation`, `nivo.lead`). */
    readonly source: string
    /** When the records were read, ISO 8601: they hold as of then. */
    readonly asOf: string
    /** The facts, one record each, in the order the source gives them (newest first for a list). */
    readonly facts: ReadonlyArray<Readonly<Record<string, unknown>>>
}

/** How many rows a context list read answers. */
export interface ContextListArgs {
    /** The most rows; the source's default when absent. */
    readonly limit?: number | undefined
}

/** The most facts one context read answers. */
const FACTS_MAX = 50

const contextResult: z.ZodType<ContextReadResult> = z.object({
    notice: z.string().max(MAX_BODY),
    source: z.string().max(MAX_ID),
    asOf: z.string().max(MAX_ID),
    facts: z.array(z.record(z.string(), z.unknown())).max(FACTS_MAX),
})

/**
 * The arguments of a list read: the most rows, nothing else. Strict: a read takes no conversation or customer id, the door fills the
 * run's own, so an id the model types is refused here before any call.
 */
const listArgsOf = (max: number, said: string): z.ZodType<ContextListArgs> =>
    z
        .object({ limit: z.number().int().min(1).max(max).optional().describe(said) })
        .strict()
        .describe("Takes no conversation or customer id: it always reads the one this run serves.")

/** The thread of the conversation the run serves: who said what and when, newest first. Reads only. */
export const conversationMessageListTool: ToolDefinition<
    z.ZodType<ContextListArgs>,
    z.ZodType<ContextReadResult>
> = defineTool({
    id: TOOL.conversationMessageList,
    title: {
        vi: "Đọc các tin nhắn gần nhất của cuộc trò chuyện đang phục vụ",
        en: "Read the latest lines of the conversation this run serves",
    },
    args: listArgsOf(30, "The most lines, newest first; 20 when absent."),
    result: contextResult,
    mutates: false,
    rights: [],
})

/** The customer the run serves: their record and what the shop's workflows remember of them. Reads only. */
export const leadProfileGetTool: ToolDefinition<
    z.ZodType<Readonly<Record<string, never>>>,
    z.ZodType<ContextReadResult>
> = defineTool({
    id: TOOL.leadProfileGet,
    title: {
        vi: "Đọc hồ sơ khách đang phục vụ: tên, liên hệ và điều tiệm đã ghi nhớ",
        en: "Read the profile of the customer this run serves: name, contact and what the shop remembers",
    },
    args: z.object({}).strict().describe("Takes no customer id: it always reads the customer this run serves."),
    result: contextResult,
    mutates: false,
    rights: [],
})

/** The latest orders of the customer the run serves, newest first, with how each delivery goes. Reads only. */
export const leadOrderListTool: ToolDefinition<
    z.ZodType<ContextListArgs>,
    z.ZodType<ContextReadResult>
> = defineTool({
    id: TOOL.leadOrderList,
    title: {
        vi: "Đọc các đơn gần nhất của khách đang phục vụ",
        en: "Read the latest orders of the customer this run serves",
    },
    args: listArgsOf(10, "The most orders, newest first; 5 when absent."),
    result: contextResult,
    mutates: false,
    rights: [],
})

/** What the shop's workflows wrote down about the customer the run serves, newest first. Reads only. */
export const leadNoteListTool: ToolDefinition<
    z.ZodType<ContextListArgs>,
    z.ZodType<ContextReadResult>
> = defineTool({
    id: TOOL.leadNoteList,
    title: {
        vi: "Đọc ghi chú các bước quy trình đã ghi về khách đang phục vụ",
        en: "Read what the workflow steps noted about the customer this run serves",
    },
    args: listArgsOf(20, "The most notes, newest first; 10 when absent."),
    result: contextResult,
    mutates: false,
    rights: [],
})

/** The context reads locked to the run's own conversation and customer: the door fills the ids and refuses any other. */
export const contextTools: ReadonlyArray<ToolDefinition> = [
    conversationMessageListTool,
    leadProfileGetTool,
    leadOrderListTool,
    leadNoteListTool,
]
