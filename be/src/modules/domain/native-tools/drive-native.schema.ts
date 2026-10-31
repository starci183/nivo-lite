import { z } from "zod"

/** The stages of a source, in the words its row keeps. */
export const DRIVE_SOURCE_STATUSES = [
    "pending",
    "queued",
    "reading",
    "indexing",
    "extracting_facts",
    "ready",
    "failed",
    "blocked_credits",
] as const

/** One stage of a source. */
export type DriveSourceStatus = (typeof DRIVE_SOURCE_STATUSES)[number]

/** `drive.status`: takes no argument. */
export const DRIVE_STATUS_SCHEMA = z.object({}).strict()

/** `drive.sources.list`: the sources the Drive feeds into the Brain, optionally in one stage. */
export const DRIVE_SOURCES_LIST_SCHEMA = z
    .object({
        status: z.enum(DRIVE_SOURCE_STATUSES).optional(),
        limit: z.number().int().min(1).max(50).default(20),
    })
    .strict()

/** The schemas the manifest advertises, generated from the validators. */
export const DRIVE_STATUS_INPUT_SCHEMA = z.toJSONSchema(DRIVE_STATUS_SCHEMA, { io: "input" })
export const DRIVE_SOURCES_LIST_INPUT_SCHEMA = z.toJSONSchema(DRIVE_SOURCES_LIST_SCHEMA, { io: "input" })
