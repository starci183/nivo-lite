import { z } from "zod"

/** `brain.search`: the facts in force and the passages of the business documents that answer a question. */
export const BRAIN_SEARCH_SCHEMA = z
    .object({
        query: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(8).default(6),
    })
    .strict()

/** `brain.facts.list`: the facts in force of the caller's view, optionally of one subject. */
export const BRAIN_FACTS_LIST_SCHEMA = z
    .object({
        subject: z.string().min(1).max(160).optional(),
        limit: z.number().int().min(1).max(50).default(20),
    })
    .strict()

/** `brain.facts.get`: one fact in force of the caller's view with its evidence. */
export const BRAIN_FACTS_GET_SCHEMA = z.object({ id: z.uuid() }).strict()

/** The arguments of `brain.search` as its validator reads them. */
export type BrainSearchInput = z.output<typeof BRAIN_SEARCH_SCHEMA>

/** The arguments of `brain.facts.list` as its validator reads them. */
export type BrainFactsListInput = z.output<typeof BRAIN_FACTS_LIST_SCHEMA>

/** The arguments of `brain.facts.get` as its validator reads them. */
export type BrainFactsGetInput = z.output<typeof BRAIN_FACTS_GET_SCHEMA>

/** The schemas the manifest advertises, generated from the validators. */
export const BRAIN_SEARCH_INPUT_SCHEMA = z.toJSONSchema(BRAIN_SEARCH_SCHEMA, { io: "input" })
export const BRAIN_FACTS_LIST_INPUT_SCHEMA = z.toJSONSchema(BRAIN_FACTS_LIST_SCHEMA, { io: "input" })
export const BRAIN_FACTS_GET_INPUT_SCHEMA = z.toJSONSchema(BRAIN_FACTS_GET_SCHEMA, { io: "input" })
