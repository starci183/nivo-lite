import { blockIndex } from "./spec"
import { BLOCKS, docOf, listNode } from "./spec.fixture"
import type { PlanView } from "./render-plan"
import { planNode, renderPlan, viewOf } from "./render-plan"
import type { SpecNode } from "./spec.types"

const root: SpecNode = {
    id: "root",
    block: "test.stack",
    props: { gap: "row" },
    children: [
        listNode("l", {
            bind: { rows: { read: "sales.orders" }, open: { action: "sales.open" } },
            when: { permission: "p" },
            forbidden: "hide",
        }),
    ],
}

describe("renderPlan", () => {
    it("resolves a sound spec: parsed props, bindings split by kind, defaults for when and forbidden", () => {
        const plan = renderPlan(docOf(root, { head: [listNode("h")], foot: [listNode("f")] }), BLOCKS)
        expect(plan.ok).toBe(true)
        if (!plan.ok) return
        const [view] = plan.views
        const child = view?.root.children[0]
        expect(view).toMatchObject({ id: "main", hidden: false, openBy: null })
        expect(view?.root.forbidden).toBe("notice")
        expect(view?.root.when).toBeNull()
        expect(child?.reads).toEqual({ rows: { read: "sales.orders" } })
        expect(child?.actions).toEqual({ open: { action: "sales.open" } })
        expect(child?.when).toEqual({ permission: "p" })
        expect(child?.forbidden).toBe("hide")
        expect(plan.head.map((node) => node.id)).toEqual(["h"])
        expect(plan.foot.map((node) => node.id)).toEqual(["f"])
    })

    it("plans a node given without props", () => {
        const plan = renderPlan(docOf({ id: "free", block: "test.free" }), BLOCKS)
        expect(plan.ok && plan.views[0]?.root.props).toEqual({})
    })

    it("carries a hidden view and its openBy", () => {
        const spec = docOf(root, {
            views: [{ id: "chat", label: { key: "c" }, root, hidden: true, openBy: "focus" }],
        })
        const plan = renderPlan(spec, BLOCKS)
        expect(plan.ok && plan.views[0]).toMatchObject({ hidden: true, openBy: "focus" })
    })

    it("hands back the problems of an invalid spec instead of a plan", () => {
        const plan = renderPlan(docOf({ id: "x", block: "test.nope" }), BLOCKS)
        expect(plan).toEqual({ ok: false, problems: [{ code: "SPEC_BLOCK_UNKNOWN", at: "main/x" }] })
    })

    it("refuses to plan a node whose block is missing, which only an unvalidated spec reaches", () => {
        expect(() => planNode(new Map(), { id: "x", block: "test.nope" })).toThrow("PLAN_SPEC_UNVALIDATED: test.nope")
    })
})

describe("viewOf", () => {
    const base: PlanView = {
        id: "base",
        label: { key: "base" },
        hidden: false,
        openBy: null,
        root: planNode(blockIndex(BLOCKS), root),
    }
    const view = (id: string, extra: Partial<PlanView> = {}): PlanView => ({ ...base, id, ...extra })
    const none = (): string | null => null

    it("opens the hidden view whose query is present, else the named tab, else the first visible view", () => {
        const views = [view("a"), view("b"), view("chat", { hidden: true, openBy: "focus" })]
        expect(viewOf(views, "b", (key) => (key === "focus" ? "42" : null))?.id).toBe("chat")
        expect(viewOf(views, "b", none)?.id).toBe("b")
        expect(viewOf(views, "zzz", none)?.id).toBe("a")
        expect(viewOf(views, null, none)?.id).toBe("a")
    })

    it("does not open a hidden view by its tab, and has none when every view is hidden", () => {
        const hidden = [view("chat", { hidden: true, openBy: "focus" }), view("plain", { hidden: true })]
        expect(viewOf(hidden, "chat", none)).toBeUndefined()
        expect(viewOf(hidden, "plain", (key) => (key === "x" ? "1" : null))).toBeUndefined()
    })
})
