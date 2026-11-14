import { z } from "zod"

/** A schema drawn as JSON Schema, or why it could not be drawn. */
export type JsonSchemaDrawing = { readonly ok: true; readonly schema: unknown } | { readonly ok: false; readonly cause: unknown }

/** The input side of a tool's zod schema as JSON Schema; a schema zod cannot draw answers its cause instead. */
export const jsonSchemaOf = (schema: z.ZodType): JsonSchemaDrawing => {
    try {
        return { ok: true, schema: z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) }
    } catch (cause: unknown) {
        return { ok: false, cause }
    }
}
