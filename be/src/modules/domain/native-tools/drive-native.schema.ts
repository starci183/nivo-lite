import { z } from "zod"

/** `drive.status`: takes no argument. */
export const DRIVE_STATUS_SCHEMA: z.ZodObject<{}, z.core.$strict> = z.object({}).strict()

/** `drive.sources.list`: the sources the Drive feeds into the Brain, optionally in one stage. */
export const DRIVE_SOURCES_LIST_SCHEMA: z.ZodObject<
    {
        status: z.ZodOptional<
            z.ZodEnum<{
                pending: "pending"
                queued: "queued"
                reading: "reading"
                indexing: "indexing"
                extracting_facts: "extracting_facts"
                ready: "ready"
                failed: "failed"
                blocked_credits: "blocked_credits"
            }>
        >
        limit: z.ZodDefault<z.ZodNumber>
    },
    z.core.$strict
> = z
    .object({
        status: z
            .enum([
                "pending",
                "queued",
                "reading",
                "indexing",
                "extracting_facts",
                "ready",
                "failed",
                "blocked_credits",
            ])
            .optional(),
        limit: z.number().int().min(1).max(50).default(20),
    })
    .strict()

/** The arguments of `drive.sources.list` as its validator reads them. */
export type DriveSourcesListInput = z.output<typeof DRIVE_SOURCES_LIST_SCHEMA>

/** The schemas the manifest advertises, generated from the validators. */
export const DRIVE_STATUS_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<z.ZodObject<{}, z.core.$strict>> =
    z.toJSONSchema(DRIVE_STATUS_SCHEMA, { io: "input" })
export const DRIVE_SOURCES_LIST_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<
    z.ZodObject<
        {
            status: z.ZodOptional<
                z.ZodEnum<{
                    pending: "pending"
                    queued: "queued"
                    reading: "reading"
                    indexing: "indexing"
                    extracting_facts: "extracting_facts"
                    ready: "ready"
                    failed: "failed"
                    blocked_credits: "blocked_credits"
                }>
            >
            limit: z.ZodDefault<z.ZodNumber>
        },
        z.core.$strict
    >
> = z.toJSONSchema(DRIVE_SOURCES_LIST_SCHEMA, { io: "input" })
