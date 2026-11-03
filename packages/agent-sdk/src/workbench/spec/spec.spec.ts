import { SDK_SPEC_BLOCKS } from "./blocks"
import { SPEC_MAX_DEPTH, isSpecText, specProblems, specRegistryOf, textOf, valueAt, variablesOf, wordsOf } from "./spec"
import type { WorkbenchSpecDocument, WorkbenchSpecNode, WorkbenchSpecRegistry, WorkbenchSpecText } from "./spec.types"

/** An owner-written text in both languages. */
const ownerText = (vi: string, en: string): WorkbenchSpecText => ({ vi, en })

const REGISTRY: WorkbenchSpecRegistry = specRegistryOf({
    blocks: SDK_SPEC_BLOCKS,
    reads: [
        {
            name: "loyalty.board",
            module: "loyalty",
            operation: "LoyaltyBoard",
            shape: "record",
            variables: {},
            paths: { members: "list", figures: "record" },
        },
        { name: "sales.board", module: "sales", operation: "SalesBoard", shape: "record", variables: {}, paths: {} },
    ],
    actions: [
        {
            name: "loyalty.open",
            module: "loyalty",
            operation: "OpenMember",
            permission: "loyalty.manage",
            label: { key: "open" },
        },
        {
            name: "sales.open",
            module: "sales",
            operation: "OpenOrder",
            permission: "sales.manage",
            label: { key: "open" },
        },
    ],
})

const LIST: WorkbenchSpecNode = {
    id: "members",
    block: "record-list",
    props: { label: { key: "members" }, empty: ownerText("Empty in vi", "Empty"), idPath: "id", titlePath: "name" },
    bind: { rows: { read: "loyalty.board", path: "members" }, open: { action: "loyalty.open" } },
}

const documentOf = (root: WorkbenchSpecNode): WorkbenchSpecDocument => ({
    schema: "nivo/workbench-spec@1",
    module: "loyalty",
    views: [{ id: "overview", label: { key: "tab_overview" }, root }],
})

const SOUND: WorkbenchSpecDocument = documentOf({
    id: "root",
    block: "stack",
    props: { gap: "region" },
    children: [
        { id: "waiting", block: "waiting" },
        {
            id: "figures",
            block: "figures",
            props: { label: { key: "figures" } },
            bind: { data: { read: "loyalty.board", path: "figures" } },
            children: [{ id: "members-count", block: "figure", props: { term: { key: "members" }, path: "members" } }],
        },
        LIST,
    ],
})

describe("specProblems", () => {
    it("accepts a tree of registered blocks bound to its own module's reads and actions", () => {
        expect(specProblems(SOUND, REGISTRY)).toEqual([])
    })

    it("refuses an unknown schema before anything else", () => {
        expect(specProblems({ ...SOUND, schema: "nivo/workbench-spec@9" }, REGISTRY)).toEqual([
            { code: "SPEC_SCHEMA_UNKNOWN", at: "schema" },
        ])
    })

    it("refuses a spec with no view and duplicate views", () => {
        expect(specProblems({ ...SOUND, views: [] }, REGISTRY)).toEqual([{ code: "SPEC_NO_VIEW", at: "views" }])
        const view = { id: "overview", label: { key: "tab_overview" }, root: LIST }
        expect(specProblems({ ...SOUND, views: [view, view] }, REGISTRY)).toEqual([
            { code: "SPEC_VIEW_DUPLICATE", at: "overview" },
        ])
    })

    it("refuses an unknown block, duplicate node ids and children under a leaf block", () => {
        const root: WorkbenchSpecNode = {
            id: "root",
            block: "stack",
            props: { gap: "row" },
            children: [
                { id: "x", block: "carousel" },
                {
                    id: "x",
                    block: "figure",
                    props: { term: { key: "a" }, path: "a" },
                    children: [{ id: "y", block: "waiting" }],
                },
            ],
        }
        expect(specProblems(documentOf(root), REGISTRY)).toEqual([
            { code: "SPEC_BLOCK_UNKNOWN", at: "overview/x" },
            { code: "SPEC_NODE_DUPLICATE", at: "overview/x" },
            { code: "SPEC_CHILDREN_REFUSED", at: "overview/x" },
        ])
    })

    it("refuses unknown, missing and mistyped props", () => {
        const root: WorkbenchSpecNode = {
            id: "root",
            block: "stack",
            props: { gap: "huge", colour: "red" },
            children: [
                { id: "s", block: "section", props: { title: 3 } },
                { id: "f", block: "figure", props: { term: { key: "a" }, path: false } },
                { id: "c", block: "card-grid", children: [] },
            ],
        }
        expect(specProblems(documentOf(root), REGISTRY)).toEqual([
            { code: "SPEC_PROP_TYPE", at: "overview/root.gap" },
            { code: "SPEC_PROP_UNKNOWN", at: "overview/root.colour" },
            { code: "SPEC_PROP_TYPE", at: "overview/s.title" },
            { code: "SPEC_PROP_TYPE", at: "overview/f.path" },
        ])
        expect(specProblems(documentOf({ id: "s", block: "section" }), REGISTRY)).toEqual([
            { code: "SPEC_PROP_MISSING", at: "overview/s.title" },
        ])
    })
})

describe("specProblems against typed props and the depth bound", () => {
    it("checks every prop type it declares", () => {
        const registry = specRegistryOf({
            blocks: [
                {
                    name: "typed",
                    props: {
                        count: { type: "number", required: false },
                        on: { type: "boolean", required: false },
                        ids: { type: "list", required: false },
                    },
                    slots: {},
                    children: false,
                },
            ],
            reads: [],
            actions: [],
        })
        const node = (props: NonNullable<WorkbenchSpecNode["props"]>): WorkbenchSpecDocument =>
            documentOf({ id: "t", block: "typed", props })
        expect(specProblems(node({ count: 2, on: true, ids: ["a", 1] }), registry)).toEqual([])
        expect(specProblems(node({ count: Number.NaN, on: "yes", ids: "a" }), registry)).toEqual([
            { code: "SPEC_PROP_TYPE", at: "overview/t.count" },
            { code: "SPEC_PROP_TYPE", at: "overview/t.on" },
            { code: "SPEC_PROP_TYPE", at: "overview/t.ids" },
        ])
    })

    it("admits any shape on a read slot that names none", () => {
        const registry = specRegistryOf({
            blocks: [{ name: "any", props: {}, slots: { data: { kind: "read", required: true } }, children: false }],
            reads: REGISTRY.reads["loyalty.board"] === undefined ? [] : [REGISTRY.reads["loyalty.board"]],
            actions: [],
        })
        expect(
            specProblems(
                documentOf({ id: "a", block: "any", bind: { data: { read: "loyalty.board", path: "members" } } }),
                registry,
            ),
        ).toEqual([])
    })

    it("refuses a tree deeper than the bound", () => {
        let node: WorkbenchSpecNode = { id: "leaf", block: "waiting" }
        for (let depth = 0; depth < SPEC_MAX_DEPTH; depth += 1)
            node = { id: `n${depth}`, block: "stack", props: { gap: "row" }, children: [node] }
        expect(specProblems(documentOf(node), REGISTRY)).toEqual([{ code: "SPEC_TOO_DEEP", at: "overview/leaf" }])
    })
})

describe("specProblems against bindings", () => {
    it("refuses unknown and missing slots, and bindings of the wrong kind, module, name or shape", () => {
        const bound = (bind: NonNullable<WorkbenchSpecNode["bind"]>): WorkbenchSpecDocument =>
            documentOf({ ...LIST, bind })
        expect(
            specProblems(
                bound({ rows: { read: "loyalty.board", path: "members" }, extra: { action: "loyalty.open" } }),
                REGISTRY,
            ),
        ).toEqual([{ code: "SPEC_SLOT_UNKNOWN", at: "overview/members.extra" }])
        expect(specProblems(bound({}), REGISTRY)).toEqual([{ code: "SPEC_SLOT_MISSING", at: "overview/members.rows" }])
        expect(
            specProblems(bound({ rows: { action: "loyalty.open" }, open: { read: "loyalty.board" } }), REGISTRY),
        ).toEqual([
            { code: "SPEC_BINDING_KIND", at: "overview/members.rows" },
            { code: "SPEC_BINDING_KIND", at: "overview/members.open" },
        ])
        expect(specProblems(bound({ rows: { read: "nope" }, open: { action: "nope" } }), REGISTRY)).toEqual([
            { code: "SPEC_BINDING_UNKNOWN", at: "overview/members.rows" },
            { code: "SPEC_BINDING_UNKNOWN", at: "overview/members.open" },
        ])
        expect(
            specProblems(bound({ rows: { read: "sales.board" }, open: { action: "sales.open" } }), REGISTRY),
        ).toEqual([
            { code: "SPEC_BINDING_FOREIGN", at: "overview/members.rows" },
            { code: "SPEC_BINDING_FOREIGN", at: "overview/members.open" },
        ])
        expect(specProblems(bound({ rows: { read: "loyalty.board", path: "secret" } }), REGISTRY)).toEqual([
            { code: "SPEC_BINDING_UNKNOWN", at: "overview/members.rows" },
        ])
        expect(specProblems(bound({ rows: { read: "loyalty.board" } }), REGISTRY)).toEqual([
            { code: "SPEC_BINDING_SHAPE", at: "overview/members.rows" },
        ])
    })
})

describe("specRegistryOf", () => {
    it("refuses two definitions under one name", () => {
        expect(() =>
            specRegistryOf({ blocks: [...SDK_SPEC_BLOCKS, ...SDK_SPEC_BLOCKS], reads: [], actions: [] }),
        ).toThrow("SPEC_REGISTRY_DUPLICATE: block stack")
    })
})

describe("the helpers a renderer draws with", () => {
    it("tells a spec text from anything else", () => {
        expect(isSpecText({ key: "a" })).toBe(true)
        expect(isSpecText({ vi: "a", en: "b" })).toBe(true)
        expect(isSpecText({ vi: "a" })).toBe(false)
        expect(isSpecText(["a"])).toBe(false)
        expect(isSpecText(null)).toBe(false)
    })

    it("walks a dotted path and stops at a missing step", () => {
        expect(valueAt({ a: { b: 3 } }, "a.b")).toBe(3)
        expect(valueAt({ a: 1 }, "a.b")).toBeUndefined()
        expect(valueAt(5, undefined)).toBe(5)
        expect(valueAt(5, "")).toBe(5)
    })

    it("draws strings and finite numbers, and nothing else", () => {
        expect(textOf("a")).toBe("a")
        expect(textOf(2)).toBe("2")
        expect(textOf(Number.POSITIVE_INFINITY)).toBe("")
        expect(textOf(true)).toBe("")
    })

    it("words a key through the translator and owner words in the viewer's language", () => {
        const translate = (key: string): string => `t:${key}`
        expect(wordsOf({ key: "a" }, translate, "vi")).toBe("t:a")
        expect(wordsOf(ownerText("Hello in vi", "Hello"), translate, "en")).toBe("Hello")
    })

    it("puts the route's installation in and keeps every other variable", () => {
        expect(variablesOf({ installationId: "$installationId", limit: 5 }, "inst-1")).toEqual({
            installationId: "inst-1",
            limit: 5,
        })
    })
})
