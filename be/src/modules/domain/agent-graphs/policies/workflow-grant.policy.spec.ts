import { Test } from "@nestjs/testing"
import type { GraphSpecGrant } from "@nivo-lite/agent-sdk/graph"
import type { DataRight } from "@nivo-lite/agent-sdk/rights"
import { coreNodes } from "@nivo-lite/blocks-core"
import { WORKFLOW_TEMPLATES, latestTemplateVersion } from "@nivo-lite/blocks-core/modules"
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

const right = (
    kind: string,
    scope: DataRight["scope"],
    fields: DataRight["fields"],
    access: DataRight["access"] = "read",
): DataRight => ({ kind, access, scope, fields })

/** The agent: reads every order of the workspace (id, amount), the customer only for the turn (name), posts to the ledger. */
const AGENT: GraphSpecGrant = {
    rights: [right("order", "workspace", ["id", "amountVnd"]), right("customer", "turn", ["name"])],
    tools: ["ledger.append"],
    effects: ["ledger.post", "work-item.raise"],
}

/** The tool set the agent's module declares. */
const AGENT_TOOLS: ReadonlyArray<string> = ["ledger.append", "ledger.post", "work-item.raise"]

describe("workflowRunGrantOf", () => {
    it("keeps the workflow's own rights, and of its tools and effects only those the agent's declared tool set holds", async () => {
        const subject = await build()
        const own: GraphSpecGrant = {
            rights: [right("order", "workspace", ["id", "note"]), right("payment", "workspace", ["id"])],
            tools: ["ledger.append", "bank.pull"],
            effects: ["ledger.post", "payment.refund"],
        }

        expect(subject.workflowRunGrantOf(own, AGENT_TOOLS)).toEqual({
            rights: own.rights,
            tools: ["ledger.append"],
            effects: ["ledger.post"],
        })
    })

    it("reaches no tool and no effect for a module that declares no agent", async () => {
        const subject = await build()
        expect(subject.workflowRunGrantOf(AGENT, null)).toEqual({ rights: AGENT.rights, tools: [], effects: [] })
    })
})

describe("every workflow template of the three agents, run as a workflow of its agent", () => {
    const nodes = new Map<string, (typeof coreNodes)[number]>(coreNodes.map((node) => [node.id, node]))

    it.each(WORKFLOW_TEMPLATES.map((template) => [template.id, template] as const))(
        "%s: its grant and every step's effects stay inside the agent's declared tool set",
        async (_id, template) => {
            const subject = await build()
            const graph = latestTemplateVersion(template).graph
            const grant = subject.workflowRunGrantOf(graph.grant, agentToolsOf(template.moduleKey))
            expect(grant.effects).toEqual(graph.grant.effects)
            expect(grant.tools).toEqual(graph.grant.tools)
            for (const node of graph.nodes) {
                expect(subject.effectsBeyond(nodes.get(node.step)?.effects ?? [], grant)).toEqual([])
            }
        },
    )

    it("covers the secondary workflows that write the customer (after-sale, web-order)", () => {
        const ids = WORKFLOW_TEMPLATES.filter((template) => !template.primary).map((template) => template.id)
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
