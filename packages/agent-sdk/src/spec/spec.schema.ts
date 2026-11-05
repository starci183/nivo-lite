import { z } from "zod"
import { KEY_MAX, LIST_MAX, NODES_MAX, RECORD_MAX, TEXT_MAX, VIEWS_MAX } from "../schema/bounds"
import { isNamespaced } from "../schema/namespaced"
import type { JsonValue } from "../schema/schema.types"
import { specText } from "../schema/spec-text.schema"
import type { SpecDocument, SpecNode, SpecParam, SpecView } from "./spec.types"

const variable = z.union([z.string().max(TEXT_MAX), z.number(), z.boolean(), z.null()])
const readBinding = z
    .object({
        read: z.string().max(KEY_MAX),
        path: z.string().max(KEY_MAX).optional(),
        variables: z
            .record(z.string().max(KEY_MAX), variable)
            .refine((entries) => Object.keys(entries).length <= RECORD_MAX)
            .optional(),
    })
    .strict()
const actionBinding = z.object({ action: z.string().max(KEY_MAX) }).strict()
const binding = z.union([readBinding, actionBinding])

/** A JSON value of bounded text, lists and objects: what a stored spec carries as the literal props of a block. */
const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
    z.union([
        z.string().max(TEXT_MAX),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(jsonValue).max(LIST_MAX),
        z.record(z.string().max(KEY_MAX), jsonValue).refine((entries) => Object.keys(entries).length <= RECORD_MAX),
    ]),
)

/** The zod schema of a node, children included. */
export const specNodeSchema: z.ZodType<SpecNode> = z.lazy(() =>
    z
        .object({
            id: z.string().min(1).max(KEY_MAX),
            block: z.string().max(KEY_MAX).refine(isNamespaced),
            props: z
                .record(z.string().max(KEY_MAX), jsonValue)
                .refine((entries) => Object.keys(entries).length <= RECORD_MAX)
                .optional(),
            bind: z
                .record(z.string().max(KEY_MAX), binding)
                .refine((entries) => Object.keys(entries).length <= RECORD_MAX)
                .optional(),
            children: z.array(specNodeSchema).max(NODES_MAX).optional(),
            when: z
                .object({ permission: z.string().min(1).max(KEY_MAX) })
                .strict()
                .optional(),
            forbidden: z.enum(["notice", "hide"]).optional(),
        })
        .strict(),
)

const viewSchema: z.ZodType<SpecView> = z
    .object({
        id: z.string().min(1).max(KEY_MAX),
        label: specText,
        root: specNodeSchema,
        hidden: z.boolean().optional(),
        openBy: z.string().min(1).max(KEY_MAX).optional(),
        count: readBinding.extend({ isAttention: z.boolean().optional() }).optional(),
        command: actionBinding.optional(),
    })
    .strict()

const paramSchema: z.ZodType<SpecParam> = z
    .object({
        type: z.enum(["string", "enum"]),
        url: z.string().min(1).max(KEY_MAX),
        of: z.union([z.array(z.string().max(KEY_MAX)).max(LIST_MAX), z.string().max(KEY_MAX)]).optional(),
        default: z.string().max(KEY_MAX).optional(),
    })
    .strict()

/** The zod schema of a spec document: the structure only; blocks, props and bindings are judged by `specProblems`. */
export const specDocumentSchema: z.ZodType<SpecDocument> = z
    .object({
        schema: z.literal("nivo/workbench-spec@2"),
        module: z.string().min(1).max(KEY_MAX),
        params: z
            .record(z.string().max(KEY_MAX), paramSchema)
            .refine((entries) => Object.keys(entries).length <= RECORD_MAX)
            .optional(),
        head: z.array(specNodeSchema).max(NODES_MAX).optional(),
        foot: z.array(specNodeSchema).max(NODES_MAX).optional(),
        views: z.array(viewSchema).max(VIEWS_MAX),
    })
    .strict()
