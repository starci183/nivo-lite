import { z } from "zod"

/** The status tool of a provider (Telegram, Zalo OA, SePay): takes no argument. */
export const PROVIDER_STATUS_SCHEMA: z.ZodObject<{}, z.core.$strict> = z.object({}).strict()

/** The schemas the manifests advertise, generated from the validators. */
export const PROVIDER_STATUS_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<z.ZodObject<{}, z.core.$strict>> =
    z.toJSONSchema(PROVIDER_STATUS_SCHEMA, { io: "input" })
