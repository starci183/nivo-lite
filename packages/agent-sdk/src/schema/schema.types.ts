import type { z } from "./zod-entry"

/** A registry id: `<namespace>.<name>`, both parts kebab-case ASCII (`core.figures`, `thay.revenue`). */
export type Namespaced = `${string}.${string}`

/** A text: a message key of the module's namespace, or owner words in both product languages. */
export type SpecText = { readonly key: string } | { readonly vi: string; readonly en: string }

/** The shape of the data a read yields or a slot draws, so a list is never bound where one record is drawn. */
export type DataShape = "record" | "list" | "value"

/** The JSON Schema `z.toJSONSchema` yields; what a composer palette reads. */
export type JsonSchema = Readonly<Record<string, unknown>>

/** A zod object whose every member converts to JSON Schema (no transform, no function, no date). */
export type PropsSchema = z.ZodObject<z.ZodRawShape>

/** Any JSON value: what a stored spec carries as literal props. */
export type JsonValue =
    string | number | boolean | null | ReadonlyArray<JsonValue> | { readonly [key: string]: JsonValue }

/** A JSON object: the shape of a tool's args and answer, and of a trigger's args and supplies, until each has its own typed signature. */
export type JsonObject = { readonly [key: string]: JsonValue }

/** The product languages. */
export type SpecLocale = "vi" | "en"
