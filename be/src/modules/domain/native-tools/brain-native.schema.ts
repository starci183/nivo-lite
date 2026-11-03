import { z } from "zod"

/** `brain.search`: the facts in force and the passages of the business documents that answer a question. */
export const BRAIN_SEARCH_SCHEMA: z.ZodObject<
    {
        query: z.ZodString
        limit: z.ZodDefault<z.ZodNumber>
    },
    z.core.$strict
> = z
    .object({
        query: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(8).default(6),
    })
    .strict()

/** `brain.facts.list`: the facts in force of the caller's view, optionally of one subject. */
export const BRAIN_FACTS_LIST_SCHEMA: z.ZodObject<
    {
        subject: z.ZodOptional<z.ZodString>
        limit: z.ZodDefault<z.ZodNumber>
    },
    z.core.$strict
> = z
    .object({
        subject: z.string().min(1).max(160).optional(),
        limit: z.number().int().min(1).max(50).default(20),
    })
    .strict()

/** `brain.facts.get`: one fact in force of the caller's view with its evidence. */
export const BRAIN_FACTS_GET_SCHEMA: z.ZodObject<
    {
        id: z.ZodUUID
    },
    z.core.$strict
> = z.object({ id: z.uuid() }).strict()

/** `brain.documents.read`: one internal document, whole, for an internal agent that drafts a public text from it. */
export const BRAIN_DOCUMENTS_READ_SCHEMA: z.ZodObject<
    {
        sourceId: z.ZodUUID
    },
    z.core.$strict
> = z.object({ sourceId: z.uuid() }).strict()

/** The arguments of `brain.documents.read` as its validator reads them. */
export type BrainDocumentsReadInput = z.output<typeof BRAIN_DOCUMENTS_READ_SCHEMA>

/** The arguments of `brain.search` as its validator reads them. */
export type BrainSearchInput = z.output<typeof BRAIN_SEARCH_SCHEMA>

/** The arguments of `brain.facts.list` as its validator reads them. */
export type BrainFactsListInput = z.output<typeof BRAIN_FACTS_LIST_SCHEMA>

/** The arguments of `brain.facts.get` as its validator reads them. */
export type BrainFactsGetInput = z.output<typeof BRAIN_FACTS_GET_SCHEMA>

/** The schemas the manifest advertises, generated from the validators. */
export const BRAIN_SEARCH_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<
    z.ZodObject<
        {
            query: z.ZodString
            limit: z.ZodDefault<z.ZodNumber>
        },
        z.core.$strict
    >
> = z.toJSONSchema(BRAIN_SEARCH_SCHEMA, { io: "input" })
export const BRAIN_FACTS_LIST_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<
    z.ZodObject<
        {
            subject: z.ZodOptional<z.ZodString>
            limit: z.ZodDefault<z.ZodNumber>
        },
        z.core.$strict
    >
> = z.toJSONSchema(BRAIN_FACTS_LIST_SCHEMA, { io: "input" })
export const BRAIN_FACTS_GET_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<
    z.ZodObject<
        {
            id: z.ZodUUID
        },
        z.core.$strict
    >
> = z.toJSONSchema(BRAIN_FACTS_GET_SCHEMA, { io: "input" })
export const BRAIN_DOCUMENTS_READ_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<
    z.ZodObject<
        {
            sourceId: z.ZodUUID
        },
        z.core.$strict
    >
> = z.toJSONSchema(BRAIN_DOCUMENTS_READ_SCHEMA, { io: "input" })
