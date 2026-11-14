import { z } from "zod"

/**
 * The providers the connection status answers a part for, by their key in the provider catalogue: the bank feed, the Zalo official
 * accounts and the Telegram bots. A provider is added here with its route (`connection-status-native.service.ts`), never matched by words.
 */
export const CONNECTION_STATUS_PROVIDERS: readonly ["sepay", "zalo_oa", "telegram"] = ["sepay", "zalo_oa", "telegram"] as const

/** A provider the connection status answers a part for. */
export type ConnectionStatusProvider = (typeof CONNECTION_STATUS_PROVIDERS)[number]

/** `nivo.tool.connection.status.get`: optionally the one provider whose accounts to answer, a key of the registered providers. */
export const CONNECTION_STATUS_SCHEMA: z.ZodObject<
    {
        provider: z.ZodOptional<
            z.ZodEnum<{
                sepay: "sepay"
                zalo_oa: "zalo_oa"
                telegram: "telegram"
            }>
        >
    },
    z.core.$strict
> = z
    .object({
        provider: z.enum(CONNECTION_STATUS_PROVIDERS).optional(),
    })
    .strict()

/** The arguments of `nivo.tool.connection.status.get` as its validator reads them. */
export type ConnectionStatusInput = z.output<typeof CONNECTION_STATUS_SCHEMA>

/** The schema the manifest advertises, generated from the validator. */
export const CONNECTION_STATUS_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<typeof CONNECTION_STATUS_SCHEMA> =
    z.toJSONSchema(CONNECTION_STATUS_SCHEMA, { io: "input" })
