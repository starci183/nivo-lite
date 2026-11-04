import { z } from "zod"
import { defineAction, defineBlock, defineRead } from "../block/block"
import type { ActionDefinition, BlockDefinition, ReadDefinition } from "../block/block.types"
import type { SpecDocument, SpecNode } from "./spec.types"

/** A container block of the spec specs: at most three children, of two kinds. */
export const STACK: BlockDefinition = defineBlock({
    id: "test.stack",
    title: { key: "stack" },
    props: z.object({ gap: z.enum(["row", "section"]) }).strict(),
    slots: {},
    children: { max: 3, accepts: ["test.stack", "test.list"] },
})

/** A leaf block with a required list slot of `order` data, an optional action slot and nested props. */
export const LIST: BlockDefinition = defineBlock({
    id: "test.list",
    title: { vi: "Danh sach", en: "List" },
    props: z.object({
        label: z.string().max(200),
        filters: z
            .array(z.object({ value: z.string().max(200) }))
            .max(100)
            .optional(),
    }),
    slots: {
        rows: { kind: "read", shape: "list", required: true, dataKind: "order" },
        open: { kind: "action", required: false },
    },
    children: false,
})

/** A block that holds anything. */
export const FREE: BlockDefinition = defineBlock({
    id: "test.free",
    title: { key: "free" },
    props: z.object({}),
    slots: { any: { kind: "read", shape: "record", required: false } },
    children: {},
})

/** A read of the `order` list the list block binds to. */
export const ORDERS: ReadDefinition = defineRead({
    id: "sales.orders",
    dataKind: "order",
    shape: "list",
    fields: ["id"],
    paths: { stats: "record", "stats.rows": "list" },
    variables: z.object({ q: z.string().max(200).optional() }),
    operation: "orders",
    permission: "sales.read",
})

/** A read of the `person` list, a data kind the list block does not accept. */
export const PEOPLE: ReadDefinition = defineRead({
    id: "sales.people",
    dataKind: "person",
    shape: "list",
    fields: ["id"],
    paths: {},
    variables: z.object({}),
    operation: "people",
    permission: "sales.read",
})

/** An action the list block binds to its optional action slot. */
export const OPEN: ActionDefinition = defineAction({
    id: "sales.open",
    operation: "open",
    permission: "sales.write",
    label: { key: "open" },
})

/** The blocks the spec specs install. */
export const BLOCKS: ReadonlyArray<BlockDefinition> = [STACK, LIST, FREE]

/** A node of the list block bound to the orders read. */
export const listNode = (id: string, extra: Partial<SpecNode> = {}): SpecNode => ({
    id,
    block: "test.list",
    props: { label: "x" },
    bind: { rows: { read: "sales.orders" } },
    ...extra,
})

/** A spec document with one view `main` rooted at `root`. */
export const docOf = (root: SpecNode, extra: Partial<SpecDocument> = {}): SpecDocument => ({
    schema: "nivo/workbench-spec@2",
    module: "sales",
    views: [{ id: "main", label: { vi: "Chinh", en: "Main" }, root }],
    ...extra,
})
