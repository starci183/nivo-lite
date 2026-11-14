import type { GraphV2NodeStep } from "@nivo-lite/agent-sdk/graph"
import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { AnyTemplateNode, TemplateAgent, TemplateGraph } from "@nivo-lite/agent-sdk/template"
import { plugin } from "./plugin"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "./crm/nivoweb/api.generated"
import { crmTools } from "./vocabulary/crm-tools"

/*
 * The providers and the mode each node of the NIVO Web agents declares (`nivo-frame.rights`: the agent attaches ACCOUNTS only; each node
 * step lists the providers it may act through, in order, and carries ONE mode): every node step of every graph of every template agent
 * lists only providers its agent attaches (NIVO itself is never listed), the CRM exactly when its node calls a CRM tool, and `ask` only on the steps
 * a person must sign (the invoice issue; R57: the registrar renewal, NIVO Web's money); the plugin declares no per-tool mode. The engine judges the providers at save (`templateGraphProblems`:
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
 * Every CRM tool id, as the CRM's document gives them, and any plugin CRM tool outside its namespace (none since R57: the invoice issue
 * is MISA meInvoice's tool, no CRM's).
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

    // R57 (owner ruling): the registrar renewal spends NIVO Web's balance at the registrar, so it asks too (owner money rule).
    // R83 (owner, interim): of the ten customer mail steps the first renewal reminder (`webrenew.round#send`) and the "renewed" notice
    // (`webrenew.renew#renewed-tell`) go by themselves (CRM data); every AI-written mail about money or a commitment asks.
    it("keeps `ask` only on the steps a person must sign: the registrar renewal, the invoice issue and the eight customer mails of R83 (four of them split by channel: one write per asked step)", () => {
        expect(steps.filter((one) => one.step.mode === "ask").map((one) => at(one)).sort()).toEqual(
            [
                "webbooks.invoice#issue",
                "webrenew.renew#renew",
                "webbooks.invoice#mail",
                "webbooks.debt-round#draft",
                "webdesk.mail-tickets#mail-reply-draft",
                "webrenew.answer#tell",
                "webrenew.answer#tell-mail",
                "websales.round#follow",
                "websales.round#follow-mail",
                "websales.close#pay",
                "websales.close#pay-mail",
                "websales.won#tell",
                "websales.won#tell-mail",
                "websales.mail-enquiries#draft",
            ].sort(),
        )
    })

    it("runs the registrar renewal and the invoice issue on their registrar and e-invoice accounts (R57)", () => {
        const of = (key: string): ReadonlyArray<string> => steps.find((one) => at(one) === key)?.step.accounts ?? []
        expect(of("webrenew.renew#renew")).toEqual([PROVIDER.inet, PROVIDER.tino])
        expect(of("webbooks.invoice#issue")).toEqual([PROVIDER.misaMeinvoice])
    })

    // R57: the CRM no longer renews (`post services/{code}/renewals` is gone); its outcome record runs on its own like the acceptance.
    it("lets the renewal's outcome record, the customer's acceptance and the customer sends run on their own", () => {
        const auto = steps.filter((one) =>
            one.node.tools.some(
                (tool) => tool === CRM_NIVOWEB.post_renewals_id_outcome || tool === CRM_NIVOWEB.post_purchases_id_acceptance || tool === CRM_NIVOWEB.post_customers,
            ),
        )
        expect(auto.map((one) => one.step.mode)).toEqual(auto.map(() => "auto"))
        expect(auto.length).toBeGreaterThan(0)
    })
})
