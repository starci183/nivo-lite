import { z } from "zod"

/** `nivo.tool.brain.passage.search`: the passages of the business documents that hold the words or the meaning of a query. */
export const PASSAGE_SEARCH_SCHEMA: z.ZodObject<
    {
        query: z.ZodString
        mode: z.ZodDefault<z.ZodEnum<{ auto: "auto"; words: "words" }>>
        limit: z.ZodDefault<z.ZodNumber>
        after: z.ZodDefault<z.ZodNumber>
    },
    z.core.$strict
> = z
    .object({
        query: z.string().min(1).max(300),
        mode: z.enum(["auto", "words"]).default("auto"),
        limit: z.number().int().min(1).max(10).default(6),
        after: z.number().int().min(0).max(80).default(0),
    })
    .strict()

/** `nivo.tool.brain.passage.read`: one passage with its neighbours, or a stretch of a document from a position. */
export const PASSAGE_READ_SCHEMA: z.ZodObject<
    {
        id: z.ZodOptional<z.ZodUUID>
        doc: z.ZodOptional<z.ZodUUID>
        at: z.ZodOptional<z.ZodNumber>
        before: z.ZodDefault<z.ZodNumber>
        after: z.ZodDefault<z.ZodNumber>
    },
    z.core.$strict
> = z
    .object({
        id: z.uuid().optional(),
        doc: z.uuid().optional(),
        at: z.number().int().min(0).max(1_000_000).optional(),
        before: z.number().int().min(0).max(5).default(1),
        after: z.number().int().min(0).max(5).default(1),
    })
    .strict()
    .refine((args) => args.id !== undefined || args.doc !== undefined, {
        message: "Give id (a passage) or doc (a document, with at)",
    })

/** The arguments of `nivo.tool.brain.passage.search` as its validator reads them. */
export type PassageSearchInput = z.output<typeof PASSAGE_SEARCH_SCHEMA>

/** The arguments of `nivo.tool.brain.passage.read` as its validator reads them. */
export type PassageReadInput = z.output<typeof PASSAGE_READ_SCHEMA>

/** The schemas the manifest advertises, generated from the validators. */
export const PASSAGE_SEARCH_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<typeof PASSAGE_SEARCH_SCHEMA> = z.toJSONSchema(
    PASSAGE_SEARCH_SCHEMA,
    { io: "input" },
)
export const PASSAGE_READ_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<typeof PASSAGE_READ_SCHEMA> = z.toJSONSchema(
    PASSAGE_READ_SCHEMA,
    { io: "input" },
)
