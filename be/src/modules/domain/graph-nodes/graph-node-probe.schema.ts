import { z } from "zod"

/** The payload of the `core.ping` effect. */
export const PROBE_PING_PAYLOAD: z.ZodType = z.object({ n: z.number() })

/** The payload of the `core.unping` effect, which undoes a ping by the subject it touched. */
export const PROBE_UNPING_PAYLOAD: z.ZodType = z.object({ id: z.string().max(200) })

/** A payload, params or input with no member. */
export const PROBE_NOTHING: z.ZodType = z.object({})

/** What the `core.look` tool answers. */
export const PROBE_LOOK_RESULT: z.ZodType = z.object({ seen: z.boolean() })

/** What the probe node is asked: whether to write a record or run an effect. */
export const PROBE_INPUT: z.ZodType = z.object({ write: z.boolean() })

/** What the probe node answers. */
export const PROBE_OUTPUT: z.ZodType = z.object({
    rows: z.number(),
    ref: z.string().max(200),
    text: z.string().max(200),
    n: z.number(),
    seen: z.boolean(),
    at: z.number(),
})

/** What the model door answers the probe node when asked for JSON. */
export const PROBE_COUNT: z.ZodObject<{ n: z.ZodNumber }> = z.object({ n: z.number() })

/** What the swallowing node answers. */
export const PROBE_SWALLOW_OUTPUT: z.ZodType = z.object({ fell: z.boolean() })

/** The fields of the `record` data kind. */
export const PROBE_RECORD_FIELDS: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().max(200) })

/** Any schema of a probe node: the wide type its definition is declared with. */
export type ProbeSchema = z.ZodType
