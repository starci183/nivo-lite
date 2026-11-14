import { Test } from "@nestjs/testing"
import type { GraphSpecGrant } from "@nivo-lite/agent-sdk/graph"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { withDefaultReads } from "./agent-tools.policy"
import { agentToolsOf } from "./flow.policy"
import { EMPTY_GRANT, effectsBeyond, ownRunGrantOf, workflowRunGrantOf } from "./workflow-grant.policy"

const SUBJECT = Symbol("workflow-grant.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { effectsBeyond, ownRunGrantOf, workflowRunGrantOf } }],
    }).compile()
    return moduleRef.get<{
        effectsBeyond: typeof effectsBeyond
        ownRunGrantOf: typeof ownRunGrantOf
        workflowRunGrantOf: typeof workflowRunGrantOf
    }>(SUBJECT)
}

/** The agent: posts to the ledger. */
const AGENT: GraphSpecGrant = {
    tools: ["nivo.tool.ledger.entry.append"],
    effects: ["ledger.post", "work-item.raise"],
}

/** The tool set the agent's module declares. */
const AGENT_TOOLS: ReadonlyArray<string> = ["nivo.tool.ledger.entry.append", "ledger.post", "work-item.raise"]

describe("workflowRunGrantOf", () => {
    it("keeps of the workflow's tools and effects only those the agent's declared tool set holds, and carries no data right", async () => {
        const subject = await build()
        const own: GraphSpecGrant = {
            tools: ["nivo.tool.ledger.entry.append", "bank.pull"],
            effects: ["ledger.post", "payment.refund"],
        }

        expect(subject.workflowRunGrantOf(own, AGENT_TOOLS)).toEqual({
            tools: withDefaultReads(["nivo.tool.ledger.entry.append"]),
            effects: ["ledger.post"],
        })
    })

    it("joins the default context reads to every run's tools, the agent's own graph included; the owner's row still refuses at the gateway", async () => {
        const subject = await build()

        expect(subject.workflowRunGrantOf({ ...AGENT, tools: [] }, AGENT_TOOLS).tools).toEqual(withDefaultReads([]))
        expect(subject.ownRunGrantOf(AGENT).tools).toEqual(withDefaultReads(["nivo.tool.ledger.entry.append"]))
        expect(subject.ownRunGrantOf(AGENT).tools).toContain(TOOL.leadOrderList)
    })

    it("reaches no tool and no effect for a module that declares no agent", async () => {
        const subject = await build()
        expect(subject.workflowRunGrantOf(AGENT, null)).toEqual({ tools: [], effects: [] })
    })
})

describe("every workflow template of the three agents, run as a workflow of its agent", () => {
    // The templates of the three core agents as the installation ships them (each graph of a template agent is one template).
    const templates = ["sales", "chatbot", "accounting"].flatMap((moduleKey) => INSTALLED.templatesOf(moduleKey))
    const installedNodes = INSTALLED.nodeInstall().nodes
    const nodes = new Map<string, (typeof installedNodes)[number]>(installedNodes.map((node) => [node.id, node]))

    it.each(templates.map((template) => [template.id, template] as const))(
        "%s: its grant and every step's effects and tools stay inside the agent's declared tool set",
        async (_id, template) => {
            const subject = await build()
            const graph = latestTemplateVersion(template).graph
            const grant = subject.workflowRunGrantOf(graph.grant, agentToolsOf(template.moduleKey))
            expect(grant.effects).toEqual(graph.grant.effects)
            expect(grant.tools).toEqual(withDefaultReads(graph.grant.tools))
            for (const node of graph.nodes) {
                expect(subject.effectsBeyond(nodes.get(node.step)?.effects ?? [], grant)).toEqual([])
                // A template node acts by tool calls alone (each call is a tool of the grant): every tool it calls is reached.
                const tools = INSTALLED.templateNodeOf(node.step)?.tools ?? []
                expect([node.key, tools.filter((tool) => !grant.tools.includes(tool))]).toEqual([node.key, []])
            }
        },
    )

    it("covers the secondary workflows that write the customer (after-sale, web-order)", () => {
        const ids = templates.filter((template) => !template.primary).map((template) => template.id)
        expect(ids).toEqual(expect.arrayContaining(["sales.after-sale", "sales.web-order"]))
    })
})

describe("effectsBeyond", () => {
    it("names the effects a node may run that a workflow's grant lacks, and none for the agent's own graph", async () => {
        const subject = await build()
        const workflow = subject.workflowRunGrantOf({ ...EMPTY_GRANT, effects: ["ledger.post"] }, AGENT_TOOLS)

        expect(subject.effectsBeyond(["ledger.post", "work-item.raise"], workflow)).toEqual(["work-item.raise"])
        expect(subject.effectsBeyond(["ledger.post"], workflow)).toEqual([])
        expect(subject.effectsBeyond(["payment.refund"], subject.ownRunGrantOf(AGENT))).toEqual([])
    })
})
