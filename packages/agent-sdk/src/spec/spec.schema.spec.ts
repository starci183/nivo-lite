import { specDocumentSchema } from "./spec.schema"

const node = { id: "root", block: "test.stack", props: { gap: "row", nested: [1, { a: null }] } }

describe("specDocumentSchema", () => {
    it("parses a whole document with every optional member", () => {
        const document = {
            schema: "nivo/workbench-spec@1",
            module: "sales",
            params: {
                q: { type: "string", url: "q" },
                stage: { type: "enum", of: "sales.leads.stage", url: "stage", default: "all" },
                pane: { type: "enum", of: ["list", "detail"], url: "pane" },
            },
            head: [node],
            foot: [{ ...node, id: "f", forbidden: "hide", when: { permission: "p" } }],
            views: [
                {
                    id: "main",
                    label: { vi: "a", en: "b" },
                    hidden: true,
                    openBy: "focus",
                    count: { read: "a.counts", path: "total", variables: { q: "$q" }, isAttention: true },
                    command: { action: "a.create" },
                    root: {
                        ...node,
                        children: [
                            {
                                id: "c",
                                block: "test.list",
                                bind: {
                                    rows: { read: "a.b", path: "x", variables: { q: "1", n: null } },
                                    open: { action: "a.c" },
                                },
                            },
                        ],
                    },
                },
            ],
        }
        expect(specDocumentSchema.parse(document)).toEqual(document)
    })

    it("parses an aside with its summary and a node shown for param values", () => {
        const document = {
            schema: "nivo/workbench-spec@1",
            module: "hiring",
            params: { pane: { type: "enum", of: ["list", "queue"], url: "pane" } },
            aside: { ...node, showWhen: { param: "pane", is: ["queue"] } },
            asideSummary: {
                read: "h.decisions",
                path: "count",
                previewPath: "rows.0.title",
                label: { key: "q" },
                opens: "queue",
            },
            views: [],
        }
        expect(specDocumentSchema.parse(document)).toEqual(document)
    })

    it("refuses an aside summary or a showWhen that is not well formed", () => {
        const base = { schema: "nivo/workbench-spec@1", module: "m", views: [] }
        const summary = { read: "a.b", label: { key: "k" }, opens: "queue" }
        const refused = (extra: object): boolean =>
            specDocumentSchema.safeParse({ ...base, ...extra }).success === false
        expect(refused({ asideSummary: { ...summary, opens: "" } })).toBe(true)
        expect(refused({ asideSummary: { read: "a.b", label: { key: "k" } } })).toBe(true)
        expect(refused({ asideSummary: { ...summary, previewPath: "" } })).toBe(true)
        expect(refused({ aside: { ...node, showWhen: { param: "p", is: [] } } })).toBe(true)
        expect(refused({ aside: { ...node, showWhen: { param: "", is: ["a"] } } })).toBe(true)
        expect(refused({ aside: { ...node, showWhen: { param: "p", is: ["a"], extra: 1 } } })).toBe(true)
        expect(refused({ aside: node, asideSummary: summary })).toBe(false)
    })

    it("refuses another schema id, an unknown member and a block that is not namespaced", () => {
        const base = { schema: "nivo/workbench-spec@1", module: "m", views: [] }
        expect(specDocumentSchema.safeParse({ ...base, schema: "nivo/workbench-spec@9" }).success).toBe(false)
        expect(specDocumentSchema.safeParse({ ...base, extra: 1 }).success).toBe(false)
        const view = { id: "v", label: { key: "k" }, root: { id: "r", block: "plain" } }
        expect(specDocumentSchema.safeParse({ ...base, views: [view] }).success).toBe(false)
    })

    it("refuses a param that is not well formed", () => {
        const base = { schema: "nivo/workbench-spec@1", module: "m", views: [] }
        const refused = (param: unknown): boolean =>
            specDocumentSchema.safeParse({ ...base, params: { a: param } }).success === false
        expect(refused({ type: "number", url: "a" })).toBe(true)
        expect(refused({ type: "string" })).toBe(true)
        expect(refused({ type: "string", url: "" })).toBe(true)
        expect(refused({ type: "string", url: "a", extra: 1 })).toBe(true)
        expect(refused({ type: "string", url: "a", default: 1 })).toBe(true)
        expect(refused({ type: "enum", of: [1], url: "a" })).toBe(true)
        expect(refused({ type: "string", url: "a" })).toBe(false)
    })

    it("refuses a view count or command that is not well formed", () => {
        const view = { id: "v", label: { key: "k" }, root: { id: "r", block: "test.stack" } }
        const refused = (extra: object): boolean =>
            specDocumentSchema.safeParse({
                schema: "nivo/workbench-spec@1",
                module: "m",
                views: [{ ...view, ...extra }],
            }).success === false
        expect(refused({ count: { read: "a.counts", isAttention: 1 } })).toBe(true)
        expect(refused({ count: { action: "a.b" } })).toBe(true)
        expect(refused({ count: { read: "a.counts", extra: 1 } })).toBe(true)
        expect(refused({ command: { read: "a.b" } })).toBe(true)
        expect(refused({ count: { read: "a.counts" }, command: { action: "a.b" } })).toBe(false)
    })
})
