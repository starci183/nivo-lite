import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import type { ApiVerb } from "@nivo-lite/agent-sdk/names"
import { corePlugin, coreBlocks, openApiReadsOf, workbenchSpecProblems } from "@nivo-lite/blocks-core"
import { plugin } from "./plugin"
import { CRM_NIVOWEB } from "./crm/nivoweb/api.generated"

/** The installation the web draws the workbench from: this plugin composed with the core package. */
const installed = defineInstallation([corePlugin, plugin], "")
const platform = installed.modules.filter((module) => module.key === "platform")
/** The modules that ship a workbench (every agent does, once its folder declares it). */
const modules = (plugin.modules ?? []).filter((module) => module.specs.length > 0)
const keys = modules.map((module) => module.key)
/** The API read of each CRM tool id: the same name (`nivo.api.crm.nivoweb.<method>.<path>`), one name for a node and a screen. */
const API_OF: ReadonlyMap<string, ApiVerb> = new Map(Object.values(CRM_NIVOWEB).map((id): [string, ApiVerb] => [id, id]))

/**
 * The reads the OpenAPI provider offers the screens of a workspace with this plugin: the CRM's GET operations by their API reads (the
 * engine offers every one of the pinned document; here the reading CRM tools give each one's shape and inputs).
 */
const providerReads = openApiReadsOf(plugin.tools ?? [], plugin.modules ?? [], ["nivo"], (tool) => API_OF.get(tool) ?? null)

/** Every block id a spec node tree names. */
const blocksOf = (node: unknown): ReadonlyArray<string> => {
    if (typeof node !== "object" || node === null) return []
    const own = "block" in node && typeof node.block === "string" ? [node.block] : []
    const children = "children" in node && Array.isArray(node.children) ? node.children.flatMap(blocksOf) : []
    const root = "root" in node ? blocksOf(node.root) : []
    return [...own, ...children, ...root]
}

/**
 * The workbench of a NIVO Web agent is its work desk (owner 2026-11-12): how it works, what waits for a person, what it just did, today's
 * counts, what it may touch, and the data it works on, each set opening its OWN data page bound to the CRM through the OpenAPI provider's
 * interface reads. No agent carries "the CRM": each lists only its own data. The tab of runs running or waiting stays after the desk.
 */
describe("the workbenches of the NIVO Web agents", () => {
    it("are shipped by every agent of the plugin", () => {
        expect(keys).toEqual((plugin.modules ?? []).map((module) => module.key))
    })

    it.each(keys)("%s: ships one seed spec the host may store and draw, opening on the desk, raw CRM tables only on data pages", (key) => {
        const module = modules.find((one) => one.key === key)

        expect(module?.specs).toHaveLength(1)
        expect(module === undefined ? ["missing"] : workbenchSpecProblems(module, coreBlocks, platform, providerReads)).toEqual([])
        expect(module?.specs[0]?.views[0]?.id).toBe("desk")
    })

    it("lists, per agent, only its own data on its desk", () => {
        const setsOf = (key: string): ReadonlyArray<string> =>
            (modules.find((one) => one.key === key)?.specs[0]?.views ?? [])
                .filter((view) => view.id.startsWith("data-"))
                .map((view) => view.id)
        expect(Object.fromEntries(keys.map((key) => [key, setsOf(key)]))).toEqual({
            webmail: [],
            webdocs: ["data-contracts"],
            webdesk: ["data-tickets"],
            webrenew: ["data-services-ending", "data-renewals-open"],
            webbooks: ["data-invoices", "data-receivables-overdue", "data-payables"],
            websales: ["data-purchases-open", "data-prices"],
        })
    })

    it("binds the data pages to reads the OpenAPI provider offers a person: the CRM's GET operations by their API reads, never a tool id", () => {
        expect(providerReads.map((read) => [read.name, read.shape])).toEqual(
            expect.arrayContaining([
                [`openapi:${CRM_NIVOWEB.get_services_expiring}`, "list"],
                [`openapi:${CRM_NIVOWEB.get_renewals_open}`, "list"],
                [`openapi:${CRM_NIVOWEB.get_renewals_id}`, "record"],
                [`openapi:${CRM_NIVOWEB.get_services_code_status}`, "record"],
                [`openapi:${CRM_NIVOWEB.get_receivables_overdue}`, "list"],
                [`openapi:${CRM_NIVOWEB.get_payables}`, "list"],
                [`openapi:${CRM_NIVOWEB.get_tickets}`, "list"],
            ]),
        )
        expect(providerReads.map((read) => [read.name, read.shape])).toEqual(
            expect.arrayContaining([
                [`openapi:${CRM_NIVOWEB.get_invoices}`, "list"],
                [`openapi:${CRM_NIVOWEB.get_contracts}`, "list"],
                [`openapi:${CRM_NIVOWEB.get_summary_counts}`, "record"],
            ]),
        )
        expect(providerReads.map((read) => read.name)).not.toContain(`openapi:${CRM_NIVOWEB.post_services_code_renewals}`)
        expect(providerReads.every((read) => read.name.startsWith("openapi:nivo.api.crm."))).toBe(true)
    })

    it.each(keys)("%s: is drawn from generic blocks only and reads nothing of its own: no module read, no action", (key) => {
        const module = modules.find((one) => one.key === key)
        const spec = module?.specs[0]

        expect([...(spec?.views ?? []).flatMap((view) => blocksOf(view)), ...blocksOf(spec?.aside)].filter((id) => !id.startsWith("core."))).toEqual([])
        expect([module?.reads, module?.actions, module?.permissions]).toEqual([[], [], []])
    })


    it.each(keys)("%s: lists this agent's runs that are running or waiting for a person", (key) => {
        const spec = JSON.stringify(modules.find((one) => one.key === key)?.specs[0] ?? null)

        expect(spec).toContain(`"read":"platform.agent-runs"`)
        expect(spec).toContain(`"installation":"$installationId","status":"running"`)
    })

    it("gives every text key of every spec words in both languages", () => {
        for (const module of modules) {
            const words = installed.messages[module.namespace]
            const missing = [...JSON.stringify(module.specs).matchAll(/"key":"([^"]+)"/gu)]
                .map((match) => match[1] ?? "")
                .filter((key) => words?.vi[key] === undefined || words.en[key] === undefined)
            expect(missing).toEqual([])
        }
    })
})
