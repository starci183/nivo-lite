import { OWNER_BRANCHES, approverOf, branchOf, draftOf, graphOf, nodeOf, packageOf } from "../tests/fixtures"
import { applyUnits, updateUnits } from "./merge"
import { previewPackage, suggestionsOf } from "./packager"
import { instantiate, resolveValues } from "./parameters"
import type { GraphDocument } from "./graph.types"

const full = (): GraphDocument => {
    const base = graphOf()
    return {
        nodes: [
            nodeOf({
                key: "start",
                kind: "trigger",
                step: "event",
                title: "Event",
                next: ["decide"],
                trigger: { eventTypes: ["order.paid"], sources: ["sepay"] },
                triggerSources: ["sepay"],
                handoverTo: "sales",
                pipeline: "ship",
                approver: approverOf({
                    onTimeout: { kind: "backup", group: { roles: ["owner"], rooms: ["r1"], members: ["m1"] } },
                }),
                uses: [
                    { provider: "mcp", tool: "mcp.x", scope: "write", label: "x", placeholder: true },
                    { provider: "mcp", tool: null, scope: "read", label: "y" },
                ],
            }),
            ...base.nodes.slice(1),
        ],
        rights: [],
    }
}

describe("previewPackage: every optional part of a node", () => {
    it("keeps the trigger, the hand-over, the pipeline and a placeholder tool, and counts the people of a backup group", () => {
        const preview = previewPackage(full(), draftOf({ bindings: [], parameters: [] }))

        const start = preview.package?.graph.nodes.find((node) => node.key === "start")
        expect(preview.problems).toEqual([])
        expect(start?.trigger).toEqual({ eventTypes: ["order.paid"], sources: ["sepay"] })
        expect(start?.triggerSources).toEqual(["sepay"])
        expect(start?.handoverTo).toBe("sales")
        expect(start?.pipeline).toBe("ship")
        expect(start?.uses[0]?.placeholder).toBe(true)
        expect(start?.approver?.onTimeout).toEqual({
            kind: "backup",
            group: { roles: ["owner"], rooms: [], members: [] },
        })
        expect(preview.report.people).toBe(6)
        expect(preview.package?.graph.contracts).toBeUndefined()
    })

    it("refuses a binding to a branch that asks nobody, and to an else branch", () => {
        const noApprover = draftOf({
            bindings: [{ parameter: "waitMinutes", target: "branch_timeout", nodeKey: "decide", branchKey: "small" }],
        })
        const elseBranch = draftOf({
            bindings: [
                { parameter: "autoLimit", target: "branch_value", nodeKey: "decide", branchKey: "else", termIndex: 0 },
            ],
        })

        expect(previewPackage(graphOf(), noApprover).problems).toEqual(["binding waitMinutes: the branch asks nobody"])
        expect(previewPackage(graphOf(), elseBranch).package).toBeNull()
    })

    it("suggests no number for a branch that has none and no wait for a branch that asks nobody", () => {
        const graph = graphOf([branchOf({ key: "only", when: "else", approver: null })])

        expect(suggestionsOf(graph)).toEqual([])
        expect(
            suggestionsOf(graphOf(OWNER_BRANCHES)).filter((entry) => entry.target === "branch_timeout"),
        ).toHaveLength(2)
    })
})

describe("resolveValues and instantiate: the edges", () => {
    const text = {
        key: "shop",
        kind: "text" as const,
        label: { vi: "a", en: "a" },
        hint: null,
        min: null,
        max: null,
        required: true,
        default: "x",
    }
    const toggle = { ...text, key: "open", kind: "toggle" as const, required: false, default: true }
    const number = { ...text, key: "n", kind: "number" as const, min: null, max: null, default: 3 }

    it("refuses a blank required text, a text where yes or no is needed, a number that is not finite and a number with no bounds set", () => {
        expect(resolveValues([text], { shop: "  " }).problems).toEqual(["shop: required"])
        expect(resolveValues([toggle], { open: "yes" }).problems).toEqual(["open: yes or no is needed"])
        expect(resolveValues([toggle], { open: false }).problems).toEqual([])
        expect(resolveValues([number], { n: Number.POSITIVE_INFINITY }).problems).toEqual(["n: a number is needed"])
        expect(resolveValues([number], { n: -5 }).problems).toEqual([])
    })

    it("leaves a placeholder nobody declared, ignores a binding that no longer lands, and keeps a graph with no contracts", () => {
        const pkg = packageOf()
        const noContracts = { ...pkg, graph: { ...pkg.graph, contracts: undefined } }
        const strayBinding = {
            ...pkg,
            bindings: [
                {
                    parameter: "autoLimit",
                    target: "branch_value" as const,
                    nodeKey: "decide",
                    branchKey: "else",
                    termIndex: 0,
                },
                { parameter: "waitMinutes", target: "branch_timeout" as const, nodeKey: "decide", branchKey: "small" },
                {
                    parameter: "ghost",
                    target: "branch_value" as const,
                    nodeKey: "decide",
                    branchKey: "small",
                    termIndex: 0,
                },
            ],
            graph: {
                ...pkg.graph,
                nodes: pkg.graph.nodes.map((node) =>
                    node.key === "decide" ? { ...node, does: "Pay {{unknown}}" } : node,
                ),
            },
        }

        expect(instantiate(noContracts, { autoLimit: 6_000_000 }).contracts).toBeUndefined()
        const filled = instantiate(strayBinding, { autoLimit: 6_000_000, waitMinutes: 90, shop: "x" })
        const decide = filled.nodes.find((node) => node.key === "decide")
        expect(decide?.does).toBe("Pay {{unknown}}")
        expect(decide?.decide?.branches.find((branch) => branch.key === "small")?.approver).toBeNull()
        expect(decide?.decide?.branches.find((branch) => branch.key === "else")?.when).toBe("else")
    })
})

describe("updateUnits: the remaining edges", () => {
    const v1 = (): GraphDocument => instantiate(packageOf(), { autoLimit: 5_000_000, waitMinutes: 240, shop: "x" })

    it("leaves alone a node the buyer dropped while the creator reworded it, and a branch in a node without a decide", () => {
        const next: GraphDocument = {
            ...v1(),
            nodes: v1().nodes.map((node) => (node.key === "end" ? { ...node, title: "Finished" } : node)),
        }
        const current: GraphDocument = { ...v1(), nodes: v1().nodes.filter((node) => node.key !== "end") }

        expect(updateUnits({ base: v1(), current, next })).toEqual([])
    })

    it("removes a node the creator dropped and keeps the rest of the graph", () => {
        const next: GraphDocument = { ...v1(), nodes: v1().nodes.filter((node) => node.key !== "end") }
        const units = updateUnits({ base: v1(), current: v1(), next })

        const result = applyUnits(
            v1(),
            next,
            units,
            units.map((unit) => unit.id),
        )

        expect(result.nodes.map((node) => node.key)).not.toContain("end")
        expect(result.nodes.map((node) => node.key)).toContain("decide")
    })

    it("treats a branch the buyer already dropped as a conflict when the creator changed it", () => {
        const dropped: GraphDocument = {
            ...v1(),
            nodes: v1().nodes.map((node) =>
                node.decide === undefined
                    ? node
                    : {
                          ...node,
                          decide: {
                              ...node.decide,
                              branches: node.decide.branches.filter((branch) => branch.key !== "small"),
                          },
                      },
            ),
        }
        const next: GraphDocument = {
            ...v1(),
            nodes: v1().nodes.map((node) =>
                node.decide === undefined
                    ? node
                    : {
                          ...node,
                          decide: {
                              ...node.decide,
                              branches: node.decide.branches.map((branch) =>
                                  branch.key === "small" ? { ...branch, outcome: "stop" as const } : branch,
                              ),
                          },
                      },
            ),
        }

        expect(
            updateUnits({ base: v1(), current: dropped, next }).find((unit) => unit.id === "branch:decide:small")
                ?.change,
        ).toBe("conflict")
    })
})

describe("the edges of conditions, wording and empty branch lists", () => {
    const only = (
        when: GraphDocument["nodes"][number]["decide"] extends infer D
            ? D extends { branches: ReadonlyArray<infer B> }
                ? B
                : never
            : never,
    ) => when

    it("suggests nothing for a term that is not a number (known, in) and keeps counting the others", () => {
        const graph = graphOf([
            branchOf({
                key: "a",
                when: {
                    all: [
                        { fact: "kind", op: "known" },
                        { fact: "kind", op: "in", value: ["x"] },
                    ],
                },
            }),
            branchOf({ key: "b", when: "else" }),
        ])

        expect(suggestionsOf(graph)).toEqual([])
    })

    it("clips a title or a sentence a value makes too long", () => {
        const pkg = packageOf()
        const long = {
            ...pkg,
            graph: {
                ...pkg.graph,
                nodes: pkg.graph.nodes.map((node) =>
                    node.key === "end" ? { ...node, title: "{{shop}}", does: "{{shop}}" } : node,
                ),
            },
        }

        const end = instantiate(long, { autoLimit: 5_000_000, waitMinutes: 240, shop: "x".repeat(300) }).nodes.find(
            (node) => node.key === "end",
        )

        expect(end?.title).toHaveLength(28)
        expect(end?.title.endsWith("…")).toBe(true)
        expect(end?.does).toHaveLength(200)
    })

    it("adds a branch to a decide node that has none, and ignores a branch unit on a node without a decide", () => {
        const empty: GraphDocument = {
            ...graphOf(),
            nodes: graphOf().nodes.map((node) =>
                node.decide === undefined ? node : { ...node, decide: { ...node.decide, branches: [] } },
            ),
        }
        const next = graphOf([only(branchOf({ key: "new", when: "else" }))])
        const units = updateUnits({ base: empty, current: empty, next })

        const added = applyUnits(empty, next, units, ["branch:decide:new"])

        expect(added.nodes.find((node) => node.key === "decide")?.decide?.branches.map((branch) => branch.key)).toEqual(
            ["new"],
        )
    })
})

describe("applyUnits: a branch for a node that has no decide point", () => {
    it("leaves the node as it is", () => {
        const current = graphOf()
        const offered: GraphDocument = {
            ...current,
            nodes: current.nodes.map((node) =>
                node.key === "end"
                    ? { ...node, decide: { intent: "x", facts: [], branches: [branchOf({ key: "x" })] } }
                    : node,
            ),
        }
        const unit = { id: "branch:end:x", nodeKey: "end", branchKey: "x", change: "added" as const }

        expect(applyUnits(current, offered, [unit], [unit.id])).toEqual(current)
    })
})
