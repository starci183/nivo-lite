import { z } from "zod"
import { specText } from "../schema/spec-text.schema"
import type { SpecDocument, SpecNode, SpecView } from "./spec.types"

const variable = z.union([z.string(), z.number(), z.boolean(), z.null()])
const binding = z.union([
    z
        .object({ read: z.string(), path: z.string().optional(), variables: z.record(z.string(), variable).optional() })
        .strict(),
    z.object({ action: z.string() }).strict(),
])

/** The zod schema of a node, children included. */
export const specNodeSchema: z.ZodType<SpecNode> = z.lazy(() =>
    z
        .object({
            id: z.string().min(1),
            block: z.templateLiteral([z.string(), ".", z.string()]),
            props: z.record(z.string(), z.json()).optional(),
            bind: z.record(z.string(), binding).optional(),
            children: z.array(specNodeSchema).optional(),
            when: z
                .object({ permission: z.string().min(1) })
                .strict()
                .optional(),
            forbidden: z.enum(["notice", "hide"]).optional(),
        })
        .strict(),
)

const viewSchema: z.ZodType<SpecView> = z
    .object({
        id: z.string().min(1),
        label: specText,
        root: specNodeSchema,
        hidden: z.boolean().optional(),
        openBy: z.string().min(1).optional(),
    })
    .strict()

/** The zod schema of a spec document: the structure only; blocks, props and bindings are judged by `specProblems`. */
export const specDocumentSchema: z.ZodType<SpecDocument> = z
    .object({
        schema: z.literal("nivo/workbench-spec@2"),
        module: z.string().min(1),
        head: z.array(specNodeSchema).optional(),
        foot: z.array(specNodeSchema).optional(),
        views: z.array(viewSchema),
    })
    .strict()
