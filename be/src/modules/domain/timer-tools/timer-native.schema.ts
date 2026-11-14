import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"
import { TIMER_DATA_BYTES_MAX, TIMER_DATA_MEMBERS_MAX, TIMER_MAX_MINUTES, TIMER_MIN_MINUTES, TIMER_REF_MAX } from "@modules/domain/agent-work"

/**
 * The bounded arguments of the generic timer tools. Every bound here is NIVO's own (a timer is the engine's, no provider documents it):
 * a `ref` of 1 to 64 characters, one of `dueAt` / `afterMinutes` (a moment at least a minute and at most 365 days away: the moment
 * is judged against the engine's clock when the tool runs), and a small FLAT record of data (text, numbers, yes/no; the store keeps a
 * task's data as a flat record) of at most 20 members and 2000 bytes as JSON.
 */

/** The longest text one member of a timer's data may be. */
const DATA_TEXT_MAX = 500

/** A key of the data: addressable by a graph trigger's `where` path `data.<key>` (a letter first, then letters, digits, `_` or `-`). */
const dataKey = z.string().max(64).regex(/^[A-Za-z][A-Za-z0-9_-]*$/)

const dataValue = z.union([z.string().max(DATA_TEXT_MAX), z.number(), z.boolean()])

const refText = z
    .string()
    .min(1)
    .max(TIMER_REF_MAX)
    .describe("The caller's own key of the timer (1 to 64 characters). Arming the same ref again for the same customer replaces its due moment.")

export const TIMER_ARM_SCHEMA: z.ZodType<{ ref: string; dueAt?: string | undefined; afterMinutes?: number | undefined; data?: Record<string, string | number | boolean> | undefined; }> = z
    .object({
        ref: refText,
        dueAt: z.iso.datetime({ offset: true }).max(64).optional().describe("The moment the timer is due (ISO 8601 with its offset). Give this or `afterMinutes`, not both."),
        afterMinutes: z
            .number()
            .int()
            .min(TIMER_MIN_MINUTES)
            .max(TIMER_MAX_MINUTES)
            .optional()
            .describe("Minutes from now until the timer is due (1 to 525600, a year). Give this or `dueAt`, not both."),
        data: z
            .record(dataKey, dataValue)
            .refine((entries) => Object.keys(entries).length <= TIMER_DATA_MEMBERS_MAX, { message: "data has too many members" })
            .optional()
            .describe("Small flat data the timer hands back when it is due (text, numbers, yes/no; at most 20 members, 2000 bytes; a key is a letter then letters, digits, `_` or `-`). A graph of this agent takes its own timers by one key: `trigger(TRIGGER.timerDue, { where: [{ param: \"data.<key>\", ... }] })`."),
    })
    .strict()
    .refine((asked) => (asked.dueAt === undefined) !== (asked.afterMinutes === undefined), { message: "exactly one of dueAt and afterMinutes" })
    .refine((asked) => asked.data === undefined || Buffer.byteLength(JSON.stringify(asked.data), "utf8") <= TIMER_DATA_BYTES_MAX, {
        message: "data is too big",
    })

export const TIMER_CANCEL_SCHEMA: z.ZodType<{ ref: string; }> = z.object({ ref: refText }).strict()

/** The schemas the manifest announces, generated from the validators. */
export const TIMER_ARM_INPUT_SCHEMA: ToolJson = z.toJSONSchema(TIMER_ARM_SCHEMA, { io: "input" })
export const TIMER_CANCEL_INPUT_SCHEMA: ToolJson = z.toJSONSchema(TIMER_CANCEL_SCHEMA, { io: "input" })
