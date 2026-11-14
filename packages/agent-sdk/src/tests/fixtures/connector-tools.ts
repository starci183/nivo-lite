import { z } from "zod"
import { defineTool, type ToolDefinition } from "../../node"

/** The words of a fixture tool's title (any text: the fixtures read none). */
const WORD = { vi: "x", en: "x" }

/** The answer envelope of a generated OpenAPI tool: the data on success, the code on a refusal. */
const envelope = (data: z.ZodType): z.ZodType =>
    z.union([z.looseObject({ ok: z.literal(true), data }), z.looseObject({ ok: z.literal(false), code: z.string() })])

/**
 * The tools of a fixture OpenAPI connector under the namespace `acme`, as an engine's source would generate them, plus one reading tool of
 * another namespace: what a spec of a package's screen rules (which reads a screen may bind) reads. Defined HERE, in the SDK's own test
 * fixtures (a home of `defineTool`, rule NIVO-TOOLS-1), so a package spec never defines a tool itself.
 */
export const ACME_TICKET_LIST: ToolDefinition = defineTool({
    id: "acme.ticket.list",
    title: WORD,
    args: z.object({ status: z.string().optional(), limit: z.number().optional() }),
    result: envelope(z.looseObject({ items: z.array(z.looseObject({})), nextCursor: z.string().nullable() })),
    mutates: false,
})

/** The record read of the fixture connector: one ticket by its id. */
export const ACME_TICKET_GET: ToolDefinition = defineTool({
    id: "acme.ticket.get",
    title: WORD,
    args: z.object({ ticketId: z.string() }),
    result: envelope(z.looseObject({ id: z.string() })),
    mutates: false,
})

/** The write of the fixture connector: never a read a screen binds. */
export const ACME_TICKET_UPDATE: ToolDefinition = defineTool({
    id: "acme.ticket.update",
    title: WORD,
    args: z.object({}),
    result: z.object({}),
    mutates: true,
})

/** A reading tool of another namespace (`other`): a connector no fixture module opens. */
export const OTHER_THING_LIST: ToolDefinition = defineTool({
    id: "other.thing.list",
    title: WORD,
    args: z.object({}),
    result: z.object({}),
    mutates: false,
})
