import { z } from "zod"

/** The status tool of a provider (Telegram, Zalo OA, SePay): takes no argument. */
export const PROVIDER_STATUS_SCHEMA: z.ZodObject<{}, z.core.$strict> = z.object({}).strict()

/** The events tool of a channel (Telegram, Zalo OA): the recent messages of one connection of the workspace. */
export const PROVIDER_EVENTS_SCHEMA: z.ZodObject<
    {
        connectionId: z.ZodUUID
        limit: z.ZodDefault<z.ZodNumber>
    },
    z.core.$strict
> = z
    .object({
        connectionId: z.uuid(),
        limit: z.number().int().min(1).max(50).default(20),
    })
    .strict()

/** The schemas the manifests advertise, generated from the validators. */
export const PROVIDER_STATUS_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<z.ZodObject<{}, z.core.$strict>> =
    z.toJSONSchema(PROVIDER_STATUS_SCHEMA, { io: "input" })
export const PROVIDER_EVENTS_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<
    z.ZodObject<
        {
            connectionId: z.ZodUUID
            limit: z.ZodDefault<z.ZodNumber>
        },
        z.core.$strict
    >
> = z.toJSONSchema(PROVIDER_EVENTS_SCHEMA, { io: "input" })
