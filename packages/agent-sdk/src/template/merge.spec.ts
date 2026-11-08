import type { GraphDocument } from "./graph.types"
import { amountIs, branchOf } from "../tests/fixtures"
import { draftOf, leakyGraph, packageOf, withExtraBranch } from "../tests/fixtures"
import { applyUnits, updateUnits } from "./merge"
import { instantiate } from "./parameters"

const VALUES = { autoLimit: 5_000_000, waitMinutes: 240, shop: "Spa Hoa" }
const v1 = (): GraphDocument => instantiate(packageOf(), VALUES)

/** Version 2: the creator raises the wait of the middle branch and adds a branch. */
const v2 = (): GraphDocument => {
    const added = withExtraBranch(leakyGraph())
    return instantiate(packageOf(added, draftOf({ version: 2 })), { ...VALUES, waitMinutes: 120 })
}

const editBranch = (
    graph: GraphDocument,
    key: string,
    edit: (branch: ReturnType<typeof branchOf>) => ReturnType<typeof branchOf>,
): GraphDocument => ({
    ...graph,
    nodes: graph.nodes.map((node) =>
        node.decide === undefined
            ? node
            : {
                  ...node,
                  decide: {
                      ...node.decide,
                      branches: node.decide.branches.map((branch) => (branch.key === key ? edit(branch) : branch)),
                  },
              },
    ),
})

const branchesOf = (graph: GraphDocument): ReadonlyArray<string> =>
    graph.nodes.find((node) => node.key === "decide")?.decide?.branches.map((branch) => branch.key) ?? []

describe("updateUnits", () => {
    it("offers a branch the creator changed and the buyer never touched as an upgrade, and a new branch as added", () => {
        const units = updateUnits({ base: v1(), current: v1(), next: v2() })

        expect(units).toContainEqual({
            id: "branch:decide:middle",
            nodeKey: "decide",
            branchKey: "middle",
            change: "upgrade",
        })
        expect(units).toContainEqual({
            id: "branch:decide:tiny",
            nodeKey: "decide",
            branchKey: "tiny",
            change: "added",
        })
    })

    it("offers a branch both changed as a conflict, so it stays the buyer own until they take it", () => {
        const edited = editBranch(v1(), "middle", (branch) => ({ ...branch, outcome: "stop" }))

        const units = updateUnits({ base: v1(), current: edited, next: v2() })

        expect(units.find((unit) => unit.id === "branch:decide:middle")?.change).toBe("conflict")
    })

    it("offers nothing for a branch the creator did not change, even if the buyer did", () => {
        const edited = editBranch(v1(), "small", (branch) => ({ ...branch, when: amountIs("lt", 9_000_000) }))

        const units = updateUnits({ base: v1(), current: edited, next: v2() })

        expect(units.some((unit) => unit.id === "branch:decide:small")).toBe(false)
    })

    it("offers nothing when the buyer already has what the creator offers", () => {
        expect(updateUnits({ base: v1(), current: v2(), next: v2() })).toEqual([])
    })
})

describe("applyUnits", () => {
    it("takes only the accepted units and keeps every edit of the buyer on the branches not accepted", () => {
        const buyerEdit = editBranch(v1(), "small", (branch) => ({ ...branch, when: amountIs("lt", 9_000_000) }))
        const units = updateUnits({ base: v1(), current: buyerEdit, next: v2() })

        const result = applyUnits(buyerEdit, v2(), units, ["branch:decide:middle"])

        const small = result.nodes
            .find((node) => node.key === "decide")
            ?.decide?.branches.find((branch) => branch.key === "small")
        const middle = result.nodes
            .find((node) => node.key === "decide")
            ?.decide?.branches.find((branch) => branch.key === "middle")
        expect(small?.when).toEqual(amountIs("lt", 9_000_000))
        expect(middle?.approver?.timeoutMinutes).toBe(120)
        expect(branchesOf(result)).not.toContain("tiny")
    })

    it("adds a new branch before the else branch, so the else stays last", () => {
        const units = updateUnits({ base: v1(), current: v1(), next: v2() })

        const result = applyUnits(v1(), v2(), units, ["branch:decide:tiny"])

        expect(branchesOf(result)).toEqual(["tiny", "small", "middle", "else"])
    })

    it("keeps the buyer graph untouched when nothing is accepted", () => {
        const units = updateUnits({ base: v1(), current: v1(), next: v2() })

        expect(applyUnits(v1(), v2(), units, [])).toEqual(v1())
    })
})
