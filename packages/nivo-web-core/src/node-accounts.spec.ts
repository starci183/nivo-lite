import type { GraphV2NodeStep } from "@nivo-lite/agent-sdk/graph"
import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { AnyTemplateNode, TemplateAgent, TemplateGraph } from "@nivo-lite/agent-sdk/template"
import { plugin } from "./plugin"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "./crm/nivoweb/api.generated"
import { crmTools } from "./vocabulary/crm-tools"

/*
 * The providers and the mode each node of the NIVO Web agents declares (`nivo-frame.rights`: the agent attaches ACCOUNTS only; each node
 * step lists the providers it may act through, in order, and carries ONE mode): every node step of every graph of every template agent
 * lists only providers its agent attaches (NIVO itself is never listed), the CRM exactly when its node calls a CRM tool, and `ask` only on the one step
 * a person must legally sign (the invoice issue); the plugin declares no per-tool mode. The engine judges the providers at save (`templateGraphProblems`:
 * `GRAPH_ACCOUNT_WIDER`, `NODE_ACCOUNT_NOT_OF_AGENT`); this pins the plugin's own design on top.
 */

/** One node step of a graph, with its graph, its agent and the node it places. */
interface Placed {
    readonly agent: TemplateAgent
    readonly graph: TemplateGraph
    readonly step: GraphV2NodeStep
    readonly node: AnyTemplateNode
}

const steps: ReadonlyArray<Placed> = (plugin.templateAgents ?? []).flatMap((agent) =>
    agent.graphs.flatMap((graph) =>
        graph.spec.nodes.flatMap((step): ReadonlyArray<Placed> => {
            const node = step.kind === "node" ? graph.nodes.get(step.step) : undefined
            return step.kind === "node" && node !== undefined ? [{ agent, graph, step, node }] : []
        }),
    ),
)
const at = (one: Placed): string => `${one.graph.key}#${one.step.key}`

/**
 * Every CRM tool id, as the CRM's document gives them, and the platform purposes the CRM serves outside its namespace (the plugin's CRM
 * tools that are no `nivo.api.crm.` id: the invoice purpose, owned by the CRM source since flipDecisions2026_11_13).
 */
const CRM_IDS: ReadonlySet<string> = new Set([
    ...Object.values(CRM_NIVOWEB),
    ...crmTools.map((tool) => tool.id).filter((id) => !id.startsWith("nivo.api.crm.")),
])
describe("the accounts the nodes of the NIVO Web agents declare", () => {
    it("places at least one node step in every graph of every agent", () => {
        for (const agent of plugin.templateAgents ?? []) {
            for (const graph of agent.graphs)
                expect([graph.key, steps.some((one) => one.graph === graph)]).toEqual([graph.key, true])
        }
    })

    it("lists on each node step only providers its agent attaches, NIVO itself never", () => {
        const wider = steps.flatMap((one) =>
            one.step.accounts
                .filter((provider) => provider === PROVIDER.nivo || !one.agent.accounts.includes(provider))
                .map((provider) => `${at(one)} ${provider}`),
        )
        expect(wider).toEqual([])
    })

    it("lists the CRM on exactly the node steps whose node calls a CRM tool", () => {
        const off = steps.flatMap((one) => {
            const calls = one.node.tools.some((tool) => CRM_IDS.has(tool))
            const lists = one.step.accounts.includes(CRM_NIVOWEB_PROVIDER)
            return calls === lists ? [] : [`${at(one)} calls the CRM ${calls} lists it ${lists}`]
        })
        expect(off).toEqual([])
    })

    it("attaches the CRM to exactly the agents whose nodes call it", () => {
        for (const agent of plugin.templateAgents ?? []) {
            const calls = steps.some((one) => one.agent === agent && one.node.tools.some((tool) => CRM_IDS.has(tool)))
            expect([agent.key, agent.accounts.includes(CRM_NIVOWEB_PROVIDER)]).toEqual([agent.key, calls])
        }
    })

    it("keeps `ask` only on the step a person must legally sign: the invoice issue", () => {
        expect(steps.filter((one) => one.step.mode === "ask").map((one) => at(one))).toEqual(["webbooks.invoice#issue"])
    })

    it("lets the provider renewal, the customer's acceptance and the customer sends run on their own", () => {
        const auto = steps.filter((one) =>
            one.node.tools.some(
                (tool) => tool === CRM_NIVOWEB.post_services_code_renewals || tool === CRM_NIVOWEB.post_purchases_id_acceptance || tool === CRM_NIVOWEB.post_customers,
            ),
        )
        expect(auto.map((one) => one.step.mode)).toEqual(auto.map(() => "auto"))
        expect(auto.length).toBeGreaterThan(0)
    })
})
