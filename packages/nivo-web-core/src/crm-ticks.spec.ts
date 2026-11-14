import { plugin } from "./plugin"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "./crm/nivoweb/api.generated"
import { crmTools } from "./vocabulary/crm-tools"

/** The platform purposes the CRM serves outside its namespace (the invoice purpose, owned by the CRM source since flipDecisions2026_11_13). */
const CRM_PURPOSES: ReadonlySet<string> = new Set(
    crmTools.map((tool) => tool.id).filter((id) => !id.startsWith("nivo.api.crm.")),
)

/*
 * The CRM rights of each agent (owner: the policy is per API operation). Since the flip an agent attaches the CRM ACCOUNT only and each
 * node step lists the CRM among its providers with one mode (`node-accounts.spec.ts`: the CRM exactly when it calls one, the invoice issue is the one `ask`);
 * the default ticks the engine attaches with are DERIVED from those steps (`abilitiesOfTemplateAgent` in the back end).
 * What stays here is the vocabulary those operations are named in.
 */

describe("the CRM ticks of the NIVO Web agents", () => {
    it("names every CRM tool under the source the plugin declares, by the tool level, and no tool by an old name", () => {
        expect(plugin.providers?.map((template) => `${template.kind}.${template.id}`)).toEqual([CRM_NIVOWEB_PROVIDER])
        expect(Object.values(CRM_NIVOWEB).filter((id) => !id.startsWith("nivo.api.crm."))).toEqual([])
        expect(
            (plugin.tools ?? [])
                .map((tool) => tool.id)
                .filter((id) => id.startsWith("crm.") || id.startsWith("nivo-web.")),
        ).toEqual([])
    })

    it("names no gone grouped ability (records.read / write / commit) anywhere: no declared default, no account of a node step", () => {
        // The defaults are derived from the template agents (no module declares `agent.abilities` since the flip); what a default can
        // tick is what the agents list and their node steps ask, so a gone grouped ability must be named nowhere there either.
        expect((plugin.modules ?? []).filter((module) => module.agent?.abilities !== undefined).map((module) => module.key)).toEqual([])
        const asked = (plugin.templateAgents ?? []).map((agent) => ({
            accounts: agent.accounts,
            steps: agent.graphs.flatMap((graph) => graph.spec.nodes.flatMap((step) => (step.kind === "node" ? step.accounts : []))),
        }))
        expect(JSON.stringify(asked)).not.toMatch(/records\./u)
    })

    it("names every CRM operation a node step's node calls by its generated id, and lists the CRM account on that step", () => {
        const ids: ReadonlySet<string> = new Set(Object.values(CRM_NIVOWEB))
        const stray = (plugin.templateAgents ?? []).flatMap((agent) =>
            agent.graphs.flatMap((graph) =>
                graph.spec.nodes.flatMap((step) => {
                    if (step.kind !== "node") return []
                    const tools: ReadonlyArray<string> = graph.nodes.get(step.step)?.tools ?? []
                    return tools
                        .filter((tool) => tool.startsWith("nivo.api.crm.") || CRM_PURPOSES.has(tool))
                        .filter((tool) => (tool.startsWith("nivo.api.crm.") && !ids.has(tool)) || !step.accounts.includes(CRM_NIVOWEB_PROVIDER))
                        .map((tool) => `${graph.key}#${step.key} ${tool}`)
                }),
            ),
        )
        expect(stray).toEqual([])
    })
})
