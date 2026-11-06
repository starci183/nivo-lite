import { BLOCKS, FREE, LIST, OPEN, ORDERS, PEOPLE, STACK, docOf, listNode } from "./spec.fixture"
import { SPEC_MAX_DEPTH, specProblems } from "./spec"
import type { SpecNode } from "./spec.types"

const BINDINGS = { reads: [ORDERS, PEOPLE], actions: [OPEN], permissions: ["sales.read"] }
const PARAMS = { q: { type: "string", url: "q" } } as const
const stack = (id: string, children: ReadonlyArray<SpecNode>): SpecNode => ({
    id,
    block: "test.stack",
    props: { gap: "row" },
    children,
})

describe("specProblems", () => {
    it("accepts a sound tree bound to installed reads and actions", () => {
        const root = stack("root", [
            listNode("l", { bind: { rows: { read: "sales.orders" }, open: { action: "sales.open" } } }),
        ])
        expect(specProblems(docOf(root), BLOCKS, BINDINGS)).toEqual([])
    })

    it("refuses an unknown schema before anything else", () => {
        expect(specProblems({ ...docOf(stack("r", [])), schema: "nivo/workbench-spec@9" }, BLOCKS)).toEqual([
            { code: "SPEC_SCHEMA_UNKNOWN", at: "schema" },
        ])
    })

    it("refuses no view and duplicate views", () => {
        expect(specProblems({ ...docOf(stack("r", [])), views: [] }, BLOCKS)).toEqual([
            { code: "SPEC_NO_VIEW", at: "views" },
        ])
        const view = { id: "main", label: { key: "m" }, root: stack("r", []) }
        expect(specProblems({ ...docOf(stack("r", [])), views: [view, view] }, BLOCKS).map((p) => p.code)).toEqual([
            "SPEC_VIEW_DUPLICATE",
        ])
    })

    it("refuses an unknown block and a node id repeated in the head, the foot or the view", () => {
        const unknown: SpecNode = { id: "x", block: "test.nope" }
        expect(specProblems(docOf(unknown), BLOCKS)).toEqual([{ code: "SPEC_BLOCK_UNKNOWN", at: "main/x" }])
        const spec = docOf(stack("a", []), { head: [stack("a", [])], foot: [stack("b", [])] })
        expect(specProblems(spec, BLOCKS)).toEqual([{ code: "SPEC_NODE_DUPLICATE", at: "main/a" }])
    })

    it("bounds the depth", () => {
        let node: SpecNode = stack("leaf", [])
        for (let level = 0; level < SPEC_MAX_DEPTH; level += 1) node = stack(`n${level}`, [node])
        expect(specProblems(docOf(node), BLOCKS)).toEqual([{ code: "SPEC_TOO_DEEP", at: "main/leaf" }])
    })

    it("names the prop path of every zod issue, with array indexes, and each unrecognized key", () => {
        const root = stack("root", [listNode("l", { props: { label: 3, filters: [{ value: "a" }, { value: 2 }] } })])
        const withExtra: SpecNode = { ...root, props: { gap: "row", colour: "red" } }
        expect(specProblems(docOf(withExtra), BLOCKS, BINDINGS)).toEqual([
            { code: "SPEC_PROP_INVALID", at: "main/root.colour" },
            { code: "SPEC_PROP_INVALID", at: "main/l.label" },
            { code: "SPEC_PROP_INVALID", at: "main/l.filters[1].value" },
        ])
        const missing: SpecNode = { id: "m", block: "test.stack" }
        expect(specProblems(docOf(missing), BLOCKS)).toEqual([{ code: "SPEC_PROP_INVALID", at: "main/m.gap" }])
    })

    it("refuses unknown and missing slots", () => {
        const odd = listNode("l", { bind: { rows: { read: "sales.orders" }, nope: { read: "sales.orders" } } })
        expect(specProblems(docOf(odd), BLOCKS, BINDINGS)).toEqual([{ code: "SPEC_SLOT_UNKNOWN", at: "main/l.nope" }])
        expect(specProblems(docOf(listNode("l", { bind: {} })), BLOCKS, BINDINGS)).toEqual([
            { code: "SPEC_SLOT_MISSING", at: "main/l.rows" },
        ])
    })

    it("refuses a binding of the wrong kind, unknown, of the wrong shape or of another data kind", () => {
        const kinds = listNode("l", { bind: { rows: { action: "sales.open" }, open: { read: "sales.orders" } } })
        expect(specProblems(docOf(kinds), BLOCKS, BINDINGS).map((p) => p.code)).toEqual([
            "SPEC_BINDING_KIND",
            "SPEC_BINDING_KIND",
        ])
        const unknown = listNode("l", {
            bind: { rows: { read: "sales.nope" }, open: { action: "sales.nope" } },
        })
        expect(specProblems(docOf(unknown), BLOCKS, BINDINGS).map((p) => p.code)).toEqual([
            "SPEC_BINDING_UNKNOWN",
            "SPEC_BINDING_UNKNOWN",
        ])
        const path = listNode("l", { bind: { rows: { read: "sales.orders", path: "gone" } } })
        expect(specProblems(docOf(path), BLOCKS, BINDINGS).map((p) => p.code)).toEqual(["SPEC_BINDING_UNKNOWN"])
        const shape = listNode("l", { bind: { rows: { read: "sales.orders", path: "stats" } } })
        expect(specProblems(docOf(shape), BLOCKS, BINDINGS).map((p) => p.code)).toEqual(["SPEC_BINDING_SHAPE"])
        const narrowed = listNode("l", { bind: { rows: { read: "sales.orders", path: "stats.rows" } } })
        expect(specProblems(docOf(narrowed), BLOCKS, BINDINGS)).toEqual([])
        const kind = listNode("l", { bind: { rows: { read: "sales.people" } } })
        expect(specProblems(docOf(kind), BLOCKS, BINDINGS).map((p) => p.code)).toEqual(["SPEC_BINDING_DATA_KIND"])
    })

    it("does not look bindings up when the caller does not know them, but still checks their kind", () => {
        const loose = listNode("l", { bind: { rows: { read: "any.thing" }, open: { action: "any.thing" } } })
        expect(specProblems(docOf(loose), BLOCKS)).toEqual([])
        const wrong = listNode("l", { bind: { rows: { action: "any.thing" } } })
        expect(specProblems(docOf(wrong), BLOCKS).map((p) => p.code)).toEqual(["SPEC_BINDING_KIND"])
    })

    it("applies the children rule: none, a maximum, an accepted list, or anything", () => {
        const leafWithKids = listNode("l", { children: [stack("k", [])] })
        expect(specProblems(docOf(leafWithKids), BLOCKS, BINDINGS)).toEqual([
            { code: "SPEC_CHILDREN_REFUSED", at: "main/l" },
        ])
        const tooMany = stack("root", [stack("a", []), stack("b", []), stack("c", []), stack("d", [])])
        expect(specProblems(docOf(tooMany), BLOCKS)).toEqual([{ code: "SPEC_CHILDREN_REFUSED", at: "main/root" }])
        const foreign = stack("root", [{ id: "f", block: "test.free" }])
        expect(specProblems(docOf(foreign), BLOCKS)).toEqual([{ code: "SPEC_CHILD_NOT_ACCEPTED", at: "main/f" }])
        const free: SpecNode = { id: "f", block: "test.free", children: [stack("k", [])] }
        expect(specProblems(docOf(free), [STACK, LIST, FREE])).toEqual([])
    })

    it("refuses a when permission the module does not declare, only when it knows them", () => {
        const guarded = stack("root", [])
        const node: SpecNode = { ...guarded, when: { permission: "sales.secret" } }
        expect(specProblems(docOf(node), BLOCKS, BINDINGS)).toEqual([{ code: "SPEC_WHEN_UNKNOWN", at: "main/root" }])
        expect(specProblems(docOf(node), BLOCKS)).toEqual([])
        const known: SpecNode = { ...guarded, when: { permission: "sales.read" } }
        expect(specProblems(docOf(known), BLOCKS, BINDINGS)).toEqual([])
    })
})

describe("specProblems params", () => {
    const withVariables = (variables: Readonly<Record<string, string | number | boolean | null>>): SpecNode =>
        listNode("l", { bind: { rows: { read: "sales.orders", variables } } })

    it("accepts a $param variable, the installation variable and a prop that names a param", () => {
        const root = stack("root", [
            withVariables({ q: "$q" }),
            { id: "s", block: "test.search", props: { searchParam: "q" } },
        ])
        expect(specProblems(docOf(root, { params: PARAMS }), BLOCKS, BINDINGS)).toEqual([])
        expect(specProblems(docOf(withVariables({ q: "$installationId" })), BLOCKS, BINDINGS)).toEqual([])
        const unset: SpecNode = { id: "s", block: "test.search" }
        expect(specProblems(docOf(unset), BLOCKS, BINDINGS)).toEqual([])
    })

    it("refuses a $name variable that names no param, even when the reads are not known", () => {
        const spec = docOf(withVariables({ q: "$gone" }), { params: PARAMS })
        expect(specProblems(spec, BLOCKS, BINDINGS)).toEqual([{ code: "SPEC_PARAM_UNKNOWN", at: "main/l.rows.q" }])
        expect(specProblems(spec, BLOCKS)).toEqual([{ code: "SPEC_PARAM_UNKNOWN", at: "main/l.rows.q" }])
        expect(specProblems(docOf(withVariables({ q: "$q" })), BLOCKS)).toEqual([
            { code: "SPEC_PARAM_UNKNOWN", at: "main/l.rows.q" },
        ])
    })

    it("refuses a prop that names no param", () => {
        const node: SpecNode = { id: "s", block: "test.search", props: { searchParam: "gone" } }
        expect(specProblems(docOf(node, { params: PARAMS }), BLOCKS, BINDINGS)).toEqual([
            { code: "SPEC_PARAM_UNKNOWN", at: "main/s.searchParam" },
        ])
        expect(specProblems(docOf(node), BLOCKS, BINDINGS)).toEqual([
            { code: "SPEC_PARAM_UNKNOWN", at: "main/s.searchParam" },
        ])
    })

    it("refuses a variable the read does not declare, only when the read is known", () => {
        const spec = docOf(withVariables({ nope: "x", q: "y" }))
        expect(specProblems(spec, BLOCKS, BINDINGS)).toEqual([{ code: "SPEC_VAR_UNKNOWN", at: "main/l.rows.nope" }])
        expect(specProblems(spec, BLOCKS)).toEqual([])
        const unknownRead = listNode("l", { bind: { rows: { read: "sales.nope", variables: { nope: "x" } } } })
        expect(specProblems(docOf(unknownRead), BLOCKS, BINDINGS).map((problem) => problem.code)).toEqual([
            "SPEC_BINDING_UNKNOWN",
        ])
    })

    it("reports the unsound params of the document", () => {
        const spec = docOf(stack("root", []), { params: { stage: { type: "enum", url: "stage" } } })
        expect(specProblems(spec, BLOCKS, BINDINGS)).toEqual([{ code: "SPEC_PARAM_INVALID", at: "params.stage" }])
    })
})

describe("specProblems showWhen", () => {
    const PANES = { pane: { type: "enum", of: ["list", "detail", "queue"], url: "pane", default: "list" } } as const
    const shown = (param: string, is: ReadonlyArray<string>): SpecNode => ({
        ...stack("s", []),
        showWhen: { param, is },
    })

    it("accepts a node shown for values its param declares", () => {
        expect(specProblems(docOf(shown("pane", ["detail", "queue"]), { params: PANES }), BLOCKS)).toEqual([])
    })

    it("accepts any value of a param that declares none", () => {
        expect(specProblems(docOf(shown("q", ["anything"]), { params: PARAMS }), BLOCKS)).toEqual([])
    })

    it("refuses a param the spec does not declare and a value the param does not allow", () => {
        expect(specProblems(docOf(shown("gone", ["a"]), { params: PANES }), BLOCKS)).toEqual([
            { code: "SPEC_PARAM_UNKNOWN", at: "main/s.showWhen" },
        ])
        expect(specProblems(docOf(shown("pane", ["detail", "why"]), { params: PANES }), BLOCKS)).toEqual([
            { code: "SPEC_PARAM_INVALID", at: "main/s.showWhen" },
        ])
    })

    it("leaves the values of a param that names a read variable to the reads that are known", () => {
        const named = { stage: { type: "enum", of: "sales.orders.stage", url: "stage" } } as const
        expect(specProblems(docOf(shown("stage", ["x"]), { params: named }), BLOCKS)).toEqual([])
    })
})

describe("specProblems aside", () => {
    const PANES = { pane: { type: "enum", of: ["list", "queue"], url: "pane", default: "list" } } as const
    const aside = stack("side", [])
    const summary = { read: "sales.people", label: { key: "queue" }, opens: "queue" }

    it("accepts an aside with a pane param, and a summary that reads an installed read and opens a pane the param has", () => {
        const spec = docOf(stack("r", []), { params: PANES, aside, asideSummary: summary })
        expect(specProblems(spec, BLOCKS, BINDINGS)).toEqual([])
    })

    it("walks the aside like a view root, its ids shared with the views", () => {
        const spec = docOf(stack("side", []), { params: PANES, aside: { id: "side", block: "test.nope" } })
        expect(specProblems(spec, BLOCKS)).toEqual([
            { code: "SPEC_BLOCK_UNKNOWN", at: "aside/side" },
            { code: "SPEC_NODE_DUPLICATE", at: "main/side" },
        ])
    })

    it("refuses an aside the phone cannot reach: no pane param", () => {
        expect(specProblems(docOf(stack("r", []), { aside }), BLOCKS)).toEqual([
            { code: "SPEC_PARAM_UNKNOWN", at: "aside" },
        ])
    })

    it("refuses a summary with no aside, an unknown read, an unknown variable and a pane the param lacks", () => {
        const orphan = docOf(stack("r", []), { params: PANES, asideSummary: summary })
        expect(specProblems(orphan, BLOCKS, BINDINGS)).toEqual([{ code: "SPEC_ASIDE_MISSING", at: "asideSummary" }])
        const bad = {
            ...summary,
            read: "sales.nope",
            variables: { q: "$gone" },
            opens: "detail",
        }
        expect(
            specProblems(docOf(stack("r", []), { params: PANES, aside, asideSummary: bad }), BLOCKS, BINDINGS),
        ).toEqual([
            { code: "SPEC_BINDING_UNKNOWN", at: "asideSummary" },
            { code: "SPEC_PARAM_UNKNOWN", at: "asideSummary.q" },
            { code: "SPEC_PARAM_INVALID", at: "asideSummary.opens" },
        ])
    })

    it("does not look the summary read up when the reads are not known", () => {
        const spec = docOf(stack("r", []), { params: PANES, aside, asideSummary: summary })
        expect(specProblems(spec, BLOCKS)).toEqual([])
    })
})
