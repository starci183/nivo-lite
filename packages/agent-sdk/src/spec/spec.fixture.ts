import { z } from "zod"
import { defineAction, defineBlock, defineRead } from "../block/block"
import type { SpecDocument, SpecNode } from "./spec.types"

/** A container block of the spec specs: at most three children, of two kinds. */
export const STACK = defineBlock({
    id: "test.stack",
    title: { key: "stack" },
    props: z.object({ gap: z.enum(["row", "section"]) }).strict(),
    slots: {},
    children: { max: 3, accepts: ["test.stack", "test.list"] },
})

/** A leaf block with a required list slot of `order` data, an optional action slot and nested props. */
export const LIST = defineBlock({
    id: "test.list",
    title: { vi: "Danh sách", en: "List" },
    props: z.object({ label: z.string(), filters: z.array(z.object({ value: z.string() })).optional() }),
    slots: {
        rows: { kind: "read", shape: "list", required: true, dataKind: "order" },
        open: { kind: "action", required: false },
    },
    children: false,
})

/** A block that holds anything. */
export const FREE = defineBlock({
    id: "test.free",
    title: { key: "free" },
    props: z.object({}),
    slots: { any: { kind: "read", shape: "record", required: false } },
    children: {},
})

export const ORDERS = defineRead({
    id: "sales.orders",
    dataKind: "order",
    shape: "list",
    fields: ["id"],
    paths: { stats: "record", "stats.rows": "list" },
    variables: z.object({ q: z.string().optional() }),
    operation: "orders",
    permission: "sales.read",
})

export const PEOPLE = defineRead({
    id: "sales.people",
    dataKind: "person",
    shape: "list",
    fields: ["id"],
    paths: {},
    variables: z.object({}),
    operation: "people",
    permission: "sales.read",
})

export const OPEN = defineAction({
    id: "sales.open",
    operation: "open",
    permission: "sales.write",
    label: { key: "open" },
})

export const BLOCKS = [STACK, LIST, FREE] as const

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
    views: [{ id: "main", label: { vi: "Chính", en: "Main" }, root }],
    ...extra,
})
