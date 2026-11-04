import type { GraphDocument } from "./graph.types"
import { instantiate } from "./parameters"
import { draftOf, leakyGraph, packageOf, withExtraBranch } from "../tests/fixtures"
import { applyUnits, updateUnits } from "./merge"
import { present } from "../schema/present"

const VALUES = { autoLimit: 5_000_000, waitMinutes: 240, shop: "Spa Hoa" }
const v1 = (): GraphDocument => instantiate(packageOf(), VALUES)

const mapNodes = (
    graph: GraphDocument,
    edit: (node: GraphDocument["nodes"][number]) => GraphDocument["nodes"][number],
): GraphDocument => ({
    ...graph,
    nodes: graph.nodes.map(edit),
})
const dropNode = (graph: GraphDocument, key: string): GraphDocument => ({
    ...graph,
    nodes: graph.nodes.filter((node) => node.key !== key),
})
const retitle = (graph: GraphDocument, key: string, title: string): GraphDocument =>
    mapNodes(graph, (node) => (node.key === key ? { ...node, title } : node))
const dropBranch = (graph: GraphDocument, key: string): GraphDocument =>
    mapNodes(graph, (node) =>
        node.decide === undefined
            ? node
            : {
                  ...node,
                  decide: { ...node.decide, branches: node.decide.branches.filter((branch) => branch.key !== key) },
              },
    )
const restyle = (graph: GraphDocument, key: string): GraphDocument =>
    mapNodes(graph, (node) =>
        node.decide === undefined
            ? node
            : {
                  ...node,
                  decide: {
                      ...node.decide,
                      branches: node.decide.branches.map((branch) =>
                          branch.key === key ? { ...branch, then: "stop" as const } : branch,
                      ),
                  },
              },
    )
const grown = (graph: GraphDocument): GraphDocument => ({
    ...graph,
    nodes: [...graph.nodes, { ...present(graph.nodes[graph.nodes.length - 1]), key: "extra", next: [] }],
})
const branchKeys = (graph: GraphDocument): ReadonlyArray<string> =>
    graph.nodes.find((node) => node.key === "decide")?.decide?.branches.map((branch) => branch.key) ?? []
const changeOf = (units: ReturnType<typeof updateUnits>, id: string): string | undefined =>
    units.find((unit) => unit.id === id)?.change

describe("updateUnits: nodes and removals", () => {
    it("offers a node the creator added, unless the buyer already has one under that key", () => {
        expect(changeOf(updateUnits({ base: v1(), current: v1(), next: grown(v1()) }), "node:extra")).toBe("added")
        expect(updateUnits({ base: v1(), current: grown(v1()), next: grown(v1()) })).toEqual([])
    })

    it("offers a node the creator dropped, only while the buyer still has it", () => {
        expect(changeOf(updateUnits({ base: v1(), current: v1(), next: dropNode(v1(), "end") }), "node:end")).toBe(
            "removed",
        )
        expect(updateUnits({ base: v1(), current: dropNode(v1(), "end"), next: dropNode(v1(), "end") })).toEqual([])
    })

    it("offers a reworded node as an upgrade when the buyer left it, a conflict when the buyer reworded it too, nothing when both agree", () => {
        const next = retitle(v1(), "end", "Finished")

        expect(changeOf(updateUnits({ base: v1(), current: v1(), next }), "node:end")).toBe("upgrade")
        expect(changeOf(updateUnits({ base: v1(), current: retitle(v1(), "end", "Mine"), next }), "node:end")).toBe(
            "conflict",
        )
        expect(updateUnits({ base: v1(), current: next, next })).toEqual([])
    })

    it("offers a branch the creator dropped while the buyer still has it", () => {
        expect(
            changeOf(
                updateUnits({ base: v1(), current: v1(), next: dropBranch(v1(), "middle") }),
                "branch:decide:middle",
            ),
        ).toBe("removed")
    })

    it("calls a branch a conflict when the creator changed it and the buyer dropped it, and when both added the same key differently", () => {
        const dropped = updateUnits({ base: v1(), current: dropBranch(v1(), "middle"), next: restyle(v1(), "middle") })
        const both = updateUnits({
            base: v1(),
            current: withExtraBranch(v1()),
            next: restyle(withExtraBranch(v1()), "tiny"),
        })

        expect(changeOf(dropped, "branch:decide:middle")).toBe("conflict")
        expect(changeOf(both, "branch:decide:tiny")).toBe("conflict")
    })
})

describe("applyUnits: nodes and removals", () => {
    it("removes a node or a branch the creator dropped, and adds a node the creator added", () => {
        const noEnd = dropNode(v1(), "end")
        const noMiddle = dropBranch(v1(), "middle")
        const removedNode = applyUnits(v1(), noEnd, updateUnits({ base: v1(), current: v1(), next: noEnd }), [
            "node:end",
        ])
        const removedBranch = applyUnits(v1(), noMiddle, updateUnits({ base: v1(), current: v1(), next: noMiddle }), [
            "branch:decide:middle",
        ])
        const added = applyUnits(v1(), grown(v1()), updateUnits({ base: v1(), current: v1(), next: grown(v1()) }), [
            "node:extra",
        ])

        expect(removedNode.nodes.some((node) => node.key === "end")).toBe(false)
        expect(branchKeys(removedBranch)).toEqual(["small", "else"])
        expect(added.nodes.some((node) => node.key === "extra")).toBe(true)
    })

    it("takes the new wording of a node and keeps the branches of the buyer on it", () => {
        const edited = restyle(v1(), "small")
        const next = retitle(v1(), "decide", "New check")

        const result = applyUnits(edited, next, updateUnits({ base: v1(), current: edited, next }), ["node:decide"])

        const decide = result.nodes.find((node) => node.key === "decide")
        expect(decide?.title).toBe("New check")
        expect(decide?.decide?.branches.find((branch) => branch.key === "small")?.then).toBe("stop")
    })

    it("takes the whole node when it has no branches of the buyer to keep", () => {
        const next = retitle(v1(), "end", "Finished")

        const result = applyUnits(v1(), next, updateUnits({ base: v1(), current: v1(), next }), ["node:end"])

        expect(result.nodes.find((node) => node.key === "end")?.title).toBe("Finished")
    })

    it("ignores a unit whose node or branch is gone from the graph of the buyer or of the version offered", () => {
        const units = [
            { id: "branch:ghost:x", nodeKey: "ghost", branchKey: "x", change: "added" as const },
            { id: "branch:decide:gone", nodeKey: "decide", branchKey: "gone", change: "upgrade" as const },
            { id: "node:ghost", nodeKey: "ghost", branchKey: null, change: "upgrade" as const },
            { id: "branch:end:x", nodeKey: "end", branchKey: "x", change: "removed" as const },
            { id: "branch:end:y", nodeKey: "end", branchKey: "y", change: "upgrade" as const },
        ]

        expect(
            applyUnits(
                v1(),
                v1(),
                units,
                units.map((unit) => unit.id),
            ),
        ).toEqual(v1())
    })

    it("builds from the creator second version of the process without touching the buyer other nodes", () => {
        const v2 = instantiate(packageOf(withExtraBranch(leakyGraph()), draftOf({ version: 2 })), VALUES)
        const units = updateUnits({ base: v1(), current: v1(), next: v2 })

        expect(
            branchKeys(
                applyUnits(
                    v1(),
                    v2,
                    units,
                    units.map((unit) => unit.id),
                ),
            ),
        ).toEqual(["tiny", "small", "middle", "else"])
    })
})
