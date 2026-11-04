import { z } from "zod"
import { ident } from "../schema/bounded.schema"
import { entriesAtMost } from "../schema/entries"
import { jsonValue } from "../schema/json-value.schema"
import { specText } from "../schema/spec-text.schema"
import type { SpecDocument, SpecNode, SpecView } from "./spec.types"

const variable = z.union([ident, z.number(), z.boolean(), z.null()])
const binding = z.union([
    z
        .object({
            read: ident,
            path: ident.optional(),
            variables: z.record(ident, variable).refine(entriesAtMost(50)).optional(),
        })
        .strict(),
    z.object({ action: ident }).strict(),
])

/** The zod schema of a node, children included. */
export const specNodeSchema: z.ZodType<SpecNode> = z.lazy(() =>
    z
        .object({
            id: ident.min(1),
            block: z.templateLiteral([ident, ".", ident]),
            props: z.record(ident, jsonValue).refine(entriesAtMost(200)).optional(),
            bind: z.record(ident, binding).refine(entriesAtMost(50)).optional(),
            children: z.array(specNodeSchema).max(200).optional(),
            when: z
                .object({ permission: ident.min(1) })
                .strict()
                .optional(),
            forbidden: z.enum(["notice", "hide"]).optional(),
        })
        .strict(),
)

const viewSchema: z.ZodType<SpecView> = z
    .object({
        id: ident.min(1),
        label: specText,
        root: specNodeSchema,
        hidden: z.boolean().optional(),
        openBy: ident.min(1).optional(),
    })
    .strict()

/** The zod schema of a spec document: the structure only; blocks, props and bindings are judged by `specProblems`. */
export const specDocumentSchema: z.ZodType<SpecDocument> = z
    .object({
        schema: z.literal("nivo/workbench-spec@2"),
        module: ident.min(1),
        head: z.array(specNodeSchema).max(50).optional(),
        foot: z.array(specNodeSchema).max(50).optional(),
        views: z.array(viewSchema).max(50),
    })
    .strict()
