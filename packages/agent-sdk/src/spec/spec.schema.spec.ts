import { specDocumentSchema } from "./spec.schema"

const node = { id: "root", block: "test.stack", props: { gap: "row", nested: [1, { a: null }] } }

describe("specDocumentSchema", () => {
    it("parses a whole document with every optional member", () => {
        const document = {
            schema: "nivo/workbench-spec@2",
            module: "sales",
            head: [node],
            foot: [{ ...node, id: "f", forbidden: "hide", when: { permission: "p" } }],
            views: [
                {
                    id: "main",
                    label: { vi: "a", en: "b" },
                    hidden: true,
                    openBy: "focus",
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

    it("refuses another schema id, an unknown member and a block that is not namespaced", () => {
        const base = { schema: "nivo/workbench-spec@2", module: "m", views: [] }
        expect(specDocumentSchema.safeParse({ ...base, schema: "nivo/workbench-spec@1" }).success).toBe(false)
        expect(specDocumentSchema.safeParse({ ...base, extra: 1 }).success).toBe(false)
        const view = { id: "v", label: { key: "k" }, root: { id: "r", block: "plain" } }
        expect(specDocumentSchema.safeParse({ ...base, views: [view] }).success).toBe(false)
    })
})
