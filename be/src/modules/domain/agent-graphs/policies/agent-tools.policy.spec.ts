import { mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition, NodeIndex } from "@nivo-lite/agent-sdk/node"
import { coreDataKinds, coreEffects, coreNodes, coreTools } from "@nivo-lite/blocks-core"
import { MODULE_DECLARATIONS, WORKFLOW_TEMPLATES } from "@nivo-lite/blocks-core/modules"
import { toolsOutsideAgent, withDefaultReads } from "./agent-tools.policy"

const indexOf = (nodes: ReadonlyArray<Partial<NodeDefinition> & { readonly id: string }>): NodeIndex =>
    mock<NodeIndex>({ nodes: new Map(nodes.map((node) => [node.id, mock<NodeDefinition>(node)])) })

const flowOf = (nodes: ReadonlyArray<{ readonly key: string; readonly step: string }>): GraphSpec =>
    mock<GraphSpec>({ moduleKey: "sales", nodes: nodes.map((node) => mock<GraphSpec["nodes"][number]>(node)) })

describe("toolsOutsideAgent", () => {
    const installed = indexOf([
        { id: "sales.create-order", effects: ["order.create", "order.confirm"], tools: [] },
        { id: "accounting.post-payment", effects: [], tools: ["ledger.append"] },
        { id: "core.stop", effects: [], tools: [] },
    ])
    const flow = flowOf([
        { key: "create-order", step: "sales.create-order" },
        { key: "ledger", step: "accounting.post-payment" },
        { key: "end", step: "core.stop" },
        { key: "ghost", step: "sales.not-installed" },
    ])

    it("names every effect and tool of a step that its module's agent does not hold, by node and tool", () => {
        expect(toolsOutsideAgent(flow, installed, ["order.create"])).toEqual([
            { code: "GRAPH_TOOL_OUTSIDE_AGENT", at: "create-order:order.confirm" },
            { code: "GRAPH_TOOL_OUTSIDE_AGENT", at: "ledger:ledger.append" },
        ])
    })

    it("finds nothing when the agent holds every tool the steps reach, and judges nothing for a module with no agent", () => {
        expect(toolsOutsideAgent(flow, installed, ["order.create", "order.confirm", "ledger.append", "extra.tool"])).toEqual([])
        expect(toolsOutsideAgent(flow, installed, null)).toEqual([])
    })
})

describe("the workflow templates NIVO ships", () => {
    const installed = nodeIndexOf({ nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds })

    it("keep every step inside the tool set of the agent of their module, in every version", () => {
        const outside = WORKFLOW_TEMPLATES.flatMap((template) => {
            const agent = MODULE_DECLARATIONS.find((module) => module.key === template.moduleKey)?.agent
            return template.versions.flatMap((version) =>
                toolsOutsideAgent(version.graph, installed, agent?.tools ?? null).map(
                    (problem) => `${template.id}@${String(version.version)} ${problem.at}`,
                ),
            )
        })
        expect(outside).toEqual([])
    })
})

describe("toolsOutsideAgent: the default reads", () => {
    it("holds every default context read, so a step reading the run's customer is never outside its agent", () => {
        const installed = indexOf([{ id: "sales.consult-turn", effects: [], tools: ["nivo.lead.order.list", "brain.search"] }])
        const flow = flowOf([{ key: "consult", step: "sales.consult-turn" }])

        expect(toolsOutsideAgent(flow, installed, ["customer.message.send"])).toEqual([])
        expect(withDefaultReads(["customer.message.send", "brain.search"])).toEqual([
            "customer.message.send",
            "brain.search",
            "nivo.conversation.message.list",
            "nivo.lead.note.list",
            "nivo.lead.order.list",
            "nivo.lead.profile.get",
        ])
    })
})
