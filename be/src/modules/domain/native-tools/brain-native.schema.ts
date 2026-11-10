import { z } from "zod"

/** `nivo.brain.search`: the facts in force and the passages of the business documents that answer a question. */
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

/** `nivo.brain.fact.list`: the facts in force of the caller's view, optionally of one subject. */
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

/** `nivo.brain.fact.get`: one fact in force of the caller's view with its evidence. */
export const BRAIN_FACTS_GET_SCHEMA: z.ZodObject<
    {
        id: z.ZodUUID
    },
    z.core.$strict
> = z.object({ id: z.uuid() }).strict()

/** `nivo.brain.document.read`: one internal document, whole, for an internal agent that drafts a public text from it. */
export const BRAIN_DOCUMENTS_READ_SCHEMA: z.ZodObject<
    {
        sourceId: z.ZodUUID
    },
    z.core.$strict
> = z.object({ sourceId: z.uuid() }).strict()

/** The arguments of `nivo.brain.document.read` as its validator reads them. */
export type BrainDocumentsReadInput = z.output<typeof BRAIN_DOCUMENTS_READ_SCHEMA>

/** The arguments of `nivo.brain.search` as its validator reads them. */
export type BrainSearchInput = z.output<typeof BRAIN_SEARCH_SCHEMA>

/** The arguments of `nivo.brain.fact.list` as its validator reads them. */
export type BrainFactsListInput = z.output<typeof BRAIN_FACTS_LIST_SCHEMA>

/** The arguments of `nivo.brain.fact.get` as its validator reads them. */
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

/** `nivo.brain.fact.related`: the truths an edge of the truth graph joins to one truth, read through the caller's lens. */
export const BRAIN_FACT_RELATED_SCHEMA: z.ZodObject<
    {
        id: z.ZodUUID
        limit: z.ZodDefault<z.ZodNumber>
    },
    z.core.$strict
> = z
    .object({
        id: z.uuid(),
        limit: z.number().int().min(1).max(30).default(10),
    })
    .strict()

/**
 * `nivo.brain.change.propose`: a change to a truth that someone said in an agent's private chat or the common chat, filed as a change
 * request for the founder. It never puts anything in force. `retire: true` asks to stop using the value in force (no `value`).
 */
export const BRAIN_CHANGE_PROPOSE_SCHEMA: z.ZodObject<
    {
        subject: z.ZodString
        attribute: z.ZodString
        value: z.ZodOptional<z.ZodString>
        unit: z.ZodOptional<z.ZodString>
        retire: z.ZodDefault<z.ZodBoolean>
        room: z.ZodEnum<{ direct: "direct"; common: "common" }>
        messageId: z.ZodUUID
        quote: z.ZodString
        reason: z.ZodString
        validFrom: z.ZodOptional<z.ZodISODateTime>
        validTo: z.ZodOptional<z.ZodISODateTime>
    },
    z.core.$strict
> = z
    .object({
        subject: z.string().min(1).max(160),
        attribute: z.string().min(1).max(120),
        value: z.string().min(1).max(500).optional(),
        unit: z.string().min(1).max(20).optional(),
        retire: z.boolean().default(false),
        room: z.enum(["direct", "common"]),
        messageId: z.uuid(),
        quote: z.string().min(1).max(500),
        reason: z.string().min(1).max(1000),
        validFrom: z.iso.datetime({ offset: true }).max(40).optional(),
        validTo: z.iso.datetime({ offset: true }).max(40).optional(),
    })
    .strict()
    .refine((args) => args.retire === (args.value === undefined), {
        message: "Give a value, or retire: true without one",
    })

/** The arguments of `nivo.brain.fact.related` as its validator reads them. */
export type BrainFactRelatedInput = z.output<typeof BRAIN_FACT_RELATED_SCHEMA>

/** The arguments of `nivo.brain.change.propose` as its validator reads them. */
export type BrainChangeProposeInput = z.output<typeof BRAIN_CHANGE_PROPOSE_SCHEMA>

/** The schemas the manifest advertises, generated from the validators. */
export const BRAIN_FACT_RELATED_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<typeof BRAIN_FACT_RELATED_SCHEMA> =
    z.toJSONSchema(BRAIN_FACT_RELATED_SCHEMA, { io: "input" })
export const BRAIN_CHANGE_PROPOSE_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<typeof BRAIN_CHANGE_PROPOSE_SCHEMA> =
    z.toJSONSchema(BRAIN_CHANGE_PROPOSE_SCHEMA, { io: "input" })
