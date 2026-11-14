import { TOOL } from "@nivo-lite/agent-sdk/names"
import { OPENAPI_PROVIDER } from "@modules/domain/openapi-tools"
import { TMPL_AGENT_TEMPLATE } from "@tests/fixtures/builders/template-plugin.builder"
import type { ProviderSpec } from "./provider-abilities.policy"
import { providersOfTemplateAgent } from "./template-agent-providers.policy"

const CRM_READ = "nivo.api.crm.nivoweb.get.customers"

const CATALOGUE: ReadonlyArray<ProviderSpec> = [
    { provider: "zalo_oa", kind: "messaging", abilities: [{ id: "customer.send", scope: "write", tools: [TOOL.customerMessageSend] }] },
    { provider: "sepay", kind: "payment", abilities: [{ id: "transactions.read", scope: "read", tools: [TOOL.paymentCreditList] }] },
    { provider: OPENAPI_PROVIDER, kind: "records", abilities: [{ id: CRM_READ, scope: "read", tools: [CRM_READ] }] },
    { provider: "misa_amis", kind: "books", abilities: [] },
]

describe("providersOfTemplateAgent", () => {
    it("names every catalogue provider the agent lists, in the agent's order, once", () => {
        expect(providersOfTemplateAgent({ accounts: ["sepay", "zalo_oa", "sepay"] }, CATALOGUE, [])).toEqual(["sepay", "zalo_oa"])
    })

    it("passes over `nivo`, an unknown key and a provider that serves no tool", () => {
        expect(providersOfTemplateAgent({ accounts: ["nivo", "nobody", "misa_amis", "zalo_oa"] }, CATALOGUE, [])).toEqual(["zalo_oa"])
    })

    it("serves a CRM provider key the installation knows (`crm.nivoweb`) by the OpenAPI provider; an unknown CRM, and the old bare source key, pass over", () => {
        expect(providersOfTemplateAgent({ accounts: ["crm.nivoweb", "crm.erp"] }, CATALOGUE, ["crm.nivoweb"])).toEqual([OPENAPI_PROVIDER])
        expect(providersOfTemplateAgent({ accounts: ["crm", "erp", "nivoweb"] }, CATALOGUE, ["crm.nivoweb"])).toEqual([])
    })

    it("reads a defined template agent as it is installed", () => {
        expect(providersOfTemplateAgent(TMPL_AGENT_TEMPLATE)).toEqual(["zalo_oa"])
    })
})
