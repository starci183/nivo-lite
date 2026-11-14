import { Test } from "@nestjs/testing"
import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { TemplateAgent } from "@nivo-lite/agent-sdk/template"
import { BASE_PLUGIN } from "@tests/fixtures/builders/base-plugin.builder"
import { NOTE_READ } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { TMPL_AGENT_TEMPLATE, TMPL_INTAKE, TMPL_PLUGIN } from "@tests/fixtures/builders/template-plugin.builder"
import { FIXTURE_ENTERPRISE, FIXTURE_MODULE, FIXTURE_PLUGIN, FIXTURE_PRIMARY, FIXTURE_TOOL } from "@tests/fixtures/builders/fixture-plugin.builder"
import type { InstalledPlugins } from "./installed-plugins.contracts"
import { installedPluginsOf } from "./installed-plugins.policy"

const SUBJECT = Symbol("installed-plugins.policy")

/** The policy under test, as Nest provides it. */
interface Subject {
    readonly installedPluginsOf: typeof installedPluginsOf
}

/** The subject as Nest provides it, and the installation of the core plugin and the fixture plugin read through it. */
const build = async (): Promise<{ readonly subject: Subject; readonly both: InstalledPlugins }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { installedPluginsOf } }],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)
    return { subject, both: subject.installedPluginsOf(defineInstallation([BASE_PLUGIN, FIXTURE_PLUGIN], "h")) }
}

describe("installedPluginsOf", () => {
    it("answers the agent, tool set, guidance and ability defaults of a module from the plugin that declares it", async () => {
        const { both } = await build()
        expect(Object.keys(both.agentOf(FIXTURE_MODULE) ?? {}).sort()).toEqual(["abilities", "tools"])
        expect(both.agentToolsOf(FIXTURE_MODULE)).toEqual([TOOL.teamMessagePost, FIXTURE_TOOL])
        expect(both.guidanceOf(FIXTURE_MODULE, "en")).toContain("Open a ticket first")
        expect(both.abilityDefaultsOf(FIXTURE_MODULE)).toEqual({ kinds: { messaging: { "customer.send": "ask" } } })
        expect(both.agentOf("platform")).toBeNull()
        expect(both.agentToolsOf("nobody")).toBeNull()
        expect(both.abilityDefaultsOf("nobody")).toBeUndefined()
    })

    it("answers a tool's label and definition, and null for a name no plugin holds (an inherited member included)", async () => {
        const { both } = await build()
        expect(both.toolLabelOf(FIXTURE_TOOL)?.kind).toBe("acts")
        expect(both.toolOf(NOTE_READ)?.id).toBe(NOTE_READ)
        expect(both.toolOf("nobody.tool")).toBeNull()
        expect(both.toolLabelOf("toString")).toBeNull()
        expect(both.nodeModelOf("fixdesk.intake")).toEqual({ model: "auto", weight: "light" })
        expect(both.nodeModelOf("toString")).toBeNull()
        expect(Object.keys(both.nodeModels())).toContain("fixdesk.intake")
    })

    it("takes a template node's model from the node itself, its weight and bound from its plugin's row while one exists", () => {
        const bare = installedPluginsOf(defineInstallation([BASE_PLUGIN, TMPL_PLUGIN], "h"))
        // No row: the node's own model, weighed heavy like an undeclared step.
        expect(bare.nodeModelOf("tmpl.triage")).toEqual({ model: "claude-sonnet-5-5", weight: "heavy" })
        expect(bare.nodeModels()["tmpl.triage"]).toEqual({ model: "claude-sonnet-5-5", weight: "heavy" })
        // A template node that calls no AI declares no model and is no AI node.
        const silent = bare.templateNodes().find((node) => node.model === undefined)
        expect(silent === undefined ? null : bare.nodeModelOf(silent.id)).toBeNull()
        const row = { model: "auto", weight: "light", maxOutputTokens: 1200, work: "chat_turn" } as const
        const withRow = installedPluginsOf(
            defineInstallation([BASE_PLUGIN, { ...TMPL_PLUGIN, nodeModels: { "tmpl.triage": row } }], "h"),
        )
        expect(withRow.nodeModelOf("tmpl.triage")).toEqual({ ...row, model: "claude-sonnet-5-5" })
    })

    it("answers the templates of every plugin, of one module and by id", async () => {
        const { both } = await build()
        const coreGraphs = (BASE_PLUGIN.templateAgents ?? []).flatMap((agent) => agent.graphs).length
        expect(coreGraphs).toBeGreaterThan(0)
        expect(both.templates().length).toBe((BASE_PLUGIN.templates ?? []).length + coreGraphs + 2)
        expect(both.templatesOf(FIXTURE_MODULE).map((template) => template.primary)).toEqual([true, false])
        expect(both.templateOf(FIXTURE_PRIMARY.id)).toBe(FIXTURE_PRIMARY)
        expect(both.templateOf("nobody.none")).toBeNull()
    })

    it("shows a template graph as its author catalogued it: name, line, version, instant and notes; the title at version 1 without", () => {
        const [intake, ...others] = TMPL_AGENT_TEMPLATE.graphs
        const catalogue = {
            name: { vi: "Ti\u1ebfp nh\u1eadn kh\u00e1ch", en: "Customer intake" },
            summary: { key: "tmplIntakeSummary" },
            version: 4,
            publishedAt: "2026-11-12T08:00:00.000Z",
            notes: { vi: "H\u1ecfi l\u1ea1i khi thi\u1ebfu \u0111\u1ecba ch\u1ec9", en: "Asks again for a missing address" },
        }
        const agent: TemplateAgent = { ...TMPL_AGENT_TEMPLATE, graphs: [{ ...intake, spec: { ...intake.spec, catalogue } }, ...others] }
        const plain = installedPluginsOf(defineInstallation([BASE_PLUGIN, TMPL_PLUGIN], "h")).templateOf(TMPL_INTAKE)
        const shown = installedPluginsOf(defineInstallation([BASE_PLUGIN, { ...TMPL_PLUGIN, templateAgents: [agent] }], "h")).templateOf(
            TMPL_INTAKE,
        )
        expect(plain?.versions.map((version) => version.version)).toEqual([1])
        expect(shown?.name).toEqual(catalogue.name)
        // A key no message catalog holds keeps the graph's own words.
        expect(shown?.summary).toEqual(plain?.summary)
        expect(shown?.versions.map(({ version, publishedAt, changes }) => ({ version, publishedAt, changes }))).toEqual([
            { version: 4, publishedAt: catalogue.publishedAt, changes: [catalogue.notes] },
        ])
        expect(shown?.versions[0]?.graph).toEqual(plain?.versions[0]?.graph)
    })

    it("hands the step runner the nodes, effects, tools, data kinds and words of every plugin, and the catalogue its servers", async () => {
        const { both } = await build()
        const install = both.nodeInstall()
        expect(install.nodes.length).toBe((BASE_PLUGIN.nodes ?? []).length + 2)
        expect(install.effects.map((effect) => effect.id)).toContain(FIXTURE_TOOL)
        expect(install.tools).toEqual(BASE_PLUGIN.tools)
        expect(install.dataKinds).toEqual(BASE_PLUGIN.dataKinds)
        expect(install.words?.("fixdeskTicketOpen")).toBeDefined()
        expect(both.servers().map((server) => server.key)).toContain(FIXTURE_MODULE)
        expect(both.plugins.map((plugin) => plugin.key)).toEqual(["core", "fixture"])
    })

    it("opens a public plugin's module to every workspace and a private one's only to the enterprises it names", async () => {
        const { both } = await build()
        expect(both.pluginOfModule(FIXTURE_MODULE)?.key).toBe("fixture")
        expect(both.pluginOfModule("sales")?.key).toBe("core")
        // A module the app still defines itself is the first plugin's, the core package.
        expect(both.pluginOfModule("hiring")?.key).toBe("core")
        expect(both.isOpenTo("sales", null)).toBe(true)
        expect(both.isOpenTo("hiring", null)).toBe(true)
        expect(both.isOpenTo(FIXTURE_MODULE, null)).toBe(false)
        expect(both.isOpenTo(FIXTURE_MODULE, "other-co")).toBe(false)
        expect(both.isOpenTo(FIXTURE_MODULE, FIXTURE_ENTERPRISE)).toBe(true)
    })

    it("answers the provider templates every plugin declares, in installation order, and none when no plugin declares one", async () => {
        const { subject, both } = await build()
        expect(both.providers()).toEqual([])
        const crm = {
            kind: "crm",
            id: "nivoweb",
            label: { vi: "CRM", en: "CRM" },
            openapi: { openapi: "3.1.0", paths: {} },
            swaggerPath: "/openapi.json",
            auth: { type: "bearer" },
            baseUrlHint: "https://crm.example.vn",
        } as const
        const withTemplate = subject.installedPluginsOf(defineInstallation([BASE_PLUGIN, { ...FIXTURE_PLUGIN, providers: [crm] }], "h"))
        expect(withTemplate.providers()).toEqual([crm])
    })

    it("knows no plugin and opens everything when nothing is installed", async () => {
        const { subject } = await build()
        const none = subject.installedPluginsOf(defineInstallation([], "h"))
        expect(none.pluginOfModule("sales")).toBeNull()
        expect(none.isOpenTo("sales", null)).toBe(true)
    })
})
