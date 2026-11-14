import { mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { NodeDefinition, NodeIndex } from "@nivo-lite/agent-sdk/node"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { coreNodeIndex, coreTemplates } from "@modules/domain/installed-plugins/installed-plugins.testing"
import { GRAPH_TOOL_OUTSIDE_AGENT, toolsOutsideAgent, withDefaultReads } from "./agent-tools.policy"
import { templateFlowProblems } from "./flow.policy"

const indexOf = (nodes: ReadonlyArray<Partial<NodeDefinition> & { readonly id: string }>): NodeIndex =>
    mock<NodeIndex>({ nodes: new Map(nodes.map((node) => [node.id, mock<NodeDefinition>(node)])) })

const flowOf = (nodes: ReadonlyArray<{ readonly key: string; readonly step: string }>): GraphSpec =>
    mock<GraphSpec>({ moduleKey: "sales", nodes: nodes.map((node) => mock<GraphSpec["nodes"][number]>(node)) })

describe("toolsOutsideAgent", () => {
    const installed = indexOf([
        { id: "sales.create-order", effects: ["nivo.tool.order.create", "nivo.tool.order.confirm"], tools: [] },
        { id: "accounting.post-payment", effects: [], tools: ["nivo.tool.ledger.entry.append"] },
        { id: "core.stop", effects: [], tools: [] },
    ])
    const flow = flowOf([
        { key: "create-order", step: "sales.create-order" },
        { key: "ledger", step: "accounting.post-payment" },
        { key: "end", step: "core.stop" },
        { key: "ghost", step: "sales.not-installed" },
    ])

    it("names every effect and tool of a step that its module's agent does not hold, by node and tool", () => {
        expect(toolsOutsideAgent(flow, installed, ["nivo.tool.order.create"])).toEqual([
            { code: "GRAPH_TOOL_OUTSIDE_AGENT", at: "create-order:nivo.tool.order.confirm" },
            { code: "GRAPH_TOOL_OUTSIDE_AGENT", at: "ledger:nivo.tool.ledger.entry.append" },
        ])
    })

    it("finds nothing when the agent holds every tool the steps reach, and judges nothing for a module with no agent", () => {
        expect(
            toolsOutsideAgent(flow, installed, [
                "nivo.tool.order.create",
                "nivo.tool.order.confirm",
                "nivo.tool.ledger.entry.append",
                "extra.tool",
            ]),
        ).toEqual([])
        expect(toolsOutsideAgent(flow, installed, null)).toEqual([])
    })
})

describe("the workflow templates NIVO ships", () => {
    const installed = coreNodeIndex()

    it("keep every step inside the tool set of the agent of their module, in every version", () => {
        // Since the flip every template is a template agent's graph: its control steps are judged on the node index, its template
        // nodes by the @2 check (`templateFlowProblems`, the same GRAPH_TOOL_OUTSIDE_AGENT), which the index knows nothing of.
        // The core package's templates, as `WORKFLOW_TEMPLATES` listed them before the flip.
        const templates = coreTemplates()
        expect(templates.length).toBeGreaterThan(0)
        const outside = templates.flatMap((template) =>
            template.versions.flatMap((version) => [
                ...toolsOutsideAgent(version.graph, installed, INSTALLED.agentToolsOf(template.moduleKey)).map(
                    (problem) => `${template.id}@${String(version.version)} ${problem.at}`,
                ),
                ...(templateFlowProblems(version.graph) ?? [])
                    .filter((problem) => problem.code === GRAPH_TOOL_OUTSIDE_AGENT)
                    .map((problem) => `${template.id}@${String(version.version)} ${problem.at}`),
            ]),
        )
        expect(outside).toEqual([])
    })
})

describe("toolsOutsideAgent: the default reads", () => {
    it("holds every default context read, so a step reading the run's customer is never outside its agent", () => {
        const installed = indexOf([
            { id: "sales.consult-turn", effects: [], tools: ["nivo.tool.lead.order.list", "nivo.tool.brain.search"] },
        ])
        const flow = flowOf([{ key: "consult", step: "sales.consult-turn" }])

        expect(toolsOutsideAgent(flow, installed, ["nivo.tool.customer.message.send"])).toEqual([])
        expect(withDefaultReads(["nivo.tool.customer.message.send", "nivo.tool.brain.search"])).toEqual([
            "nivo.tool.customer.message.send",
            "nivo.tool.brain.search",
            "nivo.tool.brain.fact.get",
            "nivo.tool.brain.fact.related",
            "nivo.tool.brain.passage.read",
            "nivo.tool.brain.passage.search",
            "nivo.tool.contact.get",
            "nivo.tool.conversation.message.list",
            "nivo.tool.lead.care.get",
            "nivo.tool.lead.order.list",
            "nivo.tool.brain.fact.list",
            "nivo.tool.brain.document.read",
            "nivo.tool.record.get",
            "nivo.tool.record.list",
            "nivo.tool.record.create",
            "nivo.tool.record.update",
            "nivo.tool.file.put",
            "nivo.tool.file.link",
            "nivo.tool.file.get",
            "nivo.tool.timer.arm",
            "nivo.tool.timer.cancel",
        ])
    })
})
