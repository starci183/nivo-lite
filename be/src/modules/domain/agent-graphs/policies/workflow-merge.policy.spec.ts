import { Test } from "@nestjs/testing"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { coreDataKinds, coreEffects, coreNodes, coreTools } from "@nivo-lite/blocks-core"
import { latestTemplateVersion } from "@nivo-lite/blocks-core/modules"
import { mergeTemplate, minimumGrantOf } from "./workflow-merge.policy"
import { templateRequired } from "./workflow-view.policy"

const SUBJECT = Symbol("workflow-merge.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { mergeTemplate, minimumGrantOf } }],
    }).compile()
    return moduleRef.get<{ mergeTemplate: typeof mergeTemplate; minimumGrantOf: typeof minimumGrantOf }>(SUBJECT)
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

const keys = (spec: GraphSpec): ReadonlyArray<string> => spec.nodes.map((entry) => entry.key)

const paramsOf = (spec: GraphSpec, key: string): unknown => spec.nodes.find((entry) => entry.key === key)?.params

const BASE = graph([node("entry", { next: "match" }), node("match", { params: { toleranceVnd: 0 } }), node("settle")])

describe("mergeTemplate: steps", () => {
    it("takes the template's change of a step the owner left alone, and keeps the owner's change of another", async () => {
        const subject = await build()
        const ours = graph([...BASE.nodes.slice(0, 2), node("settle", { params: { text: "owner" } })])
        const theirs = graph([
            BASE.nodes[0] ?? node("entry"),
            node("match", { params: { toleranceVnd: 1000 } }),
            node("settle"),
        ])

        const merged = subject.mergeTemplate(BASE, ours, theirs)

        expect(merged.conflicts).toEqual([])
        expect(paramsOf(merged.graph, "match")).toEqual({ toleranceVnd: 1000 })
        expect(paramsOf(merged.graph, "settle")).toEqual({ text: "owner" })
    })

    it("keeps the owner's side of a step both changed differently, and reports it", async () => {
        const subject = await build()
        const ours = graph([
            BASE.nodes[0] ?? node("entry"),
            node("match", { params: { toleranceVnd: 500 } }),
            node("settle"),
        ])
        const theirs = graph([
            BASE.nodes[0] ?? node("entry"),
            node("match", { params: { toleranceVnd: 1000 } }),
            node("settle"),
        ])

        const merged = subject.mergeTemplate(BASE, ours, theirs)

        expect(merged.conflicts).toEqual([{ key: "match", kept: "ours" }])
        expect(paramsOf(merged.graph, "match")).toEqual({ toleranceVnd: 500 })
    })

    it("appends the template's new steps after the owner's, keeps the owner's own steps and the step that starts", async () => {
        const subject = await build()
        const ours = graph([node("greet"), ...BASE.nodes])
        const theirs = graph([...BASE.nodes, node("report")])

        expect(keys(subject.mergeTemplate(BASE, ours, theirs).graph)).toEqual([
            "greet",
            "entry",
            "match",
            "settle",
            "report",
        ])
    })

    it("drops a step the template removed when the owner left it alone, and keeps one the owner changed", async () => {
        const subject = await build()
        const theirs = graph(BASE.nodes.slice(0, 2))

        expect(keys(subject.mergeTemplate(BASE, BASE, theirs).graph)).toEqual(["entry", "match"])

        const ours = graph([...BASE.nodes.slice(0, 2), node("settle", { params: { text: "owner" } })])
        const merged = subject.mergeTemplate(BASE, ours, theirs)

        expect(keys(merged.graph)).toEqual(["entry", "match", "settle"])
        expect(merged.conflicts).toEqual([{ key: "settle", kept: "ours" }])
    })
})

describe("mergeTemplate: trigger and grant", () => {
    it("takes the template's trigger when the owner kept the old one, and unions the grants", async () => {
        const subject = await build()
        const theirs = graph(BASE.nodes, {
            trigger: { kind: "tag", sources: ["channel", "schedule"] },
            grant: {
                rights: [{ kind: "order", access: "read", scope: "workspace", fields: ["amountVnd"] }],
                tools: ["ledger.append"],
                effects: [],
            },
        })
        const ours = graph(BASE.nodes, {
            grant: {
                rights: [{ kind: "order", access: "read", scope: "workspace", fields: ["id"] }],
                tools: [],
                effects: ["channel.send"],
            },
        })

        const merged = subject.mergeTemplate(BASE, ours, theirs).graph

        expect(merged.trigger.sources).toEqual(["channel", "schedule"])
        expect(merged.grant).toEqual({
            rights: [{ kind: "order", access: "read", scope: "workspace", fields: ["id", "amountVnd"] }],
            tools: ["ledger.append"],
            effects: ["channel.send"],
        })
    })
})

describe("minimumGrantOf", () => {
    it("cuts a wide grant to what the installed steps need, and never adds to it", async () => {
        const subject = await build()
        const index = nodeIndexOf({
            nodes: coreNodes,
            effects: coreEffects,
            tools: coreTools,
            dataKinds: coreDataKinds,
        })
        const reports = latestTemplateVersion(templateRequired("accounting.reports")).graph
        const reconcile = latestTemplateVersion(templateRequired("accounting.reconcile")).graph.grant
        const wide = {
            rights: [...reconcile.rights, ...reports.grant.rights],
            tools: [...reconcile.tools, ...reports.grant.tools],
            effects: [...reconcile.effects, ...reports.grant.effects],
        }

        expect(subject.minimumGrantOf({ ...reports, grant: wide }, index)).toEqual(reports.grant)
        expect(subject.minimumGrantOf({ ...reports, grant: { rights: [], tools: [], effects: [] } }, index)).toEqual({
            rights: [],
            tools: [],
            effects: [],
        })
    })
})
