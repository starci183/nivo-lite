import { z } from "zod"

/** The bounded filters of the e-invoice list tool. */
export const EinvoiceListSchema: z.ZodObject<
    {
        since: z.ZodOptional<z.ZodISODate>
        limit: z.ZodDefault<z.ZodNumber>
    },
    z.core.$strict
> = z.strictObject({
    since: z.iso.date().min(10).max(10).optional(),
    limit: z.number().int().min(1).max(50).default(20),
})

/** The bounded identifier of one invoice returned by the list tool. */
export const EinvoiceGetSchema: z.ZodObject<
    {
        id: z.ZodString
    },
    z.core.$strict
> = z.strictObject({
    id: z.string().min(1).max(200),
})

/** The list-tool contract announced to MCP clients, generated from its argument validator. */
export const EINVOICE_LIST_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<
    z.ZodObject<
        {
            since: z.ZodOptional<z.ZodISODate>
            limit: z.ZodDefault<z.ZodNumber>
        },
        z.core.$strict
    >
> = z.toJSONSchema(EinvoiceListSchema, { io: "input" })

/** The get-tool contract announced to MCP clients, generated from its argument validator. */
export const EINVOICE_GET_INPUT_SCHEMA: z.core.ZodStandardJSONSchemaPayload<
    z.ZodObject<
        {
            id: z.ZodString
        },
        z.core.$strict
    >
> = z.toJSONSchema(EinvoiceGetSchema, { io: "input" })
