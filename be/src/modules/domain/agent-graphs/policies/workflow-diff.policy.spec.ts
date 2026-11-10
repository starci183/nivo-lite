import { Test } from "@nestjs/testing"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { canonicalText, changedStepCount, sameJson, workflowDiffOf } from "./workflow-diff.policy"

const SUBJECT = Symbol("workflow-diff.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { workflowDiffOf, changedStepCount, sameJson, canonicalText } }],
    }).compile()
    return moduleRef.get<{
        workflowDiffOf: typeof workflowDiffOf
        changedStepCount: typeof changedStepCount
        sameJson: typeof sameJson
        canonicalText: typeof canonicalText
    }>(SUBJECT)
}

const node = (key: string, extra: Partial<GraphSpecNode> = {}): GraphSpecNode => ({
    key,
    kind: "output",
    step: `test.${key}`,
    ...extra,
})

const graph = (nodes: ReadonlyArray<GraphSpecNode>, extra: Partial<GraphSpec> = {}): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: "accounting",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes,
    ...extra,
})

describe("workflowDiffOf", () => {
    it("finds no change between two graphs that differ only in the order of their keys", async () => {
        const subject = await build()
        const before = graph([node("match", { params: { toleranceVnd: 0, windowHours: 72 } })])
        const after = graph([node("match", { params: { windowHours: 72, toleranceVnd: 0 } })])

        expect(subject.workflowDiffOf(before, after).steps).toEqual([])
        expect(subject.sameJson({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true)
        expect(subject.canonicalText({ b: 1, a: undefined })).toBe('{"b":1}')
    })

    it("lists added, changed and removed steps, the changed settings with their values", async () => {
        const subject = await build()
        const before = graph([
            node("entry", { next: "match" }),
            node("match", { params: { toleranceVnd: 0 } }),
            node("old"),
        ])
        const after = graph([
            node("entry", { next: "match" }),
            node("match", { params: { toleranceVnd: 1000 } }),
            node("report", { blocking: false }),
        ])

        const diff = subject.workflowDiffOf(before, after)

        expect(diff.steps).toEqual([
            {
                key: "match",
                change: "changed",
                step: "test.match",
                parts: ["params"],
                params: [{ name: "toleranceVnd", before: 0, after: 1000 }],
            },
            { key: "report", change: "added", step: "test.report", parts: [], params: [] },
            { key: "old", change: "removed", step: "test.old", parts: [], params: [] },
        ])
        expect(subject.changedStepCount(before, after)).toBe(3)
    })
})

describe("workflowDiffOf: edges, first versions, trigger and grant", () => {
    it("names the edges and the wait of a step that moved", async () => {
        const subject = await build()
        const before = graph([node("a", { next: "b" }), node("b")])
        const after = graph([node("a", { next: "c", wait: { kind: "payment", timeout: "2h" } }), node("b")])

        expect(subject.workflowDiffOf(before, after).steps[0]?.parts).toEqual(["next", "wait"])
    })

    it("makes every step of a first version added, and never calls its trigger changed", async () => {
        const subject = await build()
        const diff = subject.workflowDiffOf(null, graph([node("a"), node("b")]))

        expect(diff.steps.map((step) => step.change)).toEqual(["added", "added"])
        expect(diff.triggerChanged).toBe(false)
    })

    it("says what the trigger and the grant gained and lost", async () => {
        const subject = await build()
        const before = graph([node("a")], {
            grant: {
                rights: [{ kind: "order", access: "read", scope: "workspace", fields: ["id", "status"] }],
                tools: ["nivo.ledger.entry.append"],
                effects: [],
            },
        })
        const after = graph([node("a")], {
            trigger: { kind: "tag", sources: ["schedule"] },
            grant: {
                rights: [{ kind: "order", access: "read", scope: "workspace", fields: ["id", "amountVnd"] }],
                tools: [],
                effects: ["channel.send"],
            },
        })

        expect(subject.workflowDiffOf(before, after)).toMatchObject({
            triggerChanged: true,
            grant: {
                rightsAdded: ["order:read.amountVnd"],
                rightsRemoved: ["order:read.status"],
                toolsAdded: [],
                toolsRemoved: ["nivo.ledger.entry.append"],
                effectsAdded: ["channel.send"],
                effectsRemoved: [],
            },
        })
    })
})
