import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { requireSoundFlow } from "@modules/domain/agent-graphs/policies/flow.policy"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { NATIVE_TOOL_DEFINITIONS } from "@modules/domain/tool-specs/native-tool-definitions.policy"
import { MODULE_CATALOG } from "@modules/domain/modules"
import { BASE_PLUGIN } from "@tests/fixtures/builders/base-plugin.builder"
import {
    FIXTURE_MODULE,
    FIXTURE_PRIMARY,
    FIXTURE_SECONDARY,
    FIXTURE_TOOL,
} from "@tests/fixtures/builders/fixture-plugin.builder"

// PLUGIN-AGENTS: the same engine with the fixture plugin taken OUT of the array (`[base]`, a neutral first plugin keyed `core`): nothing of
// it is left anywhere the engine reads, and the first plugin's declarations are exactly what that plugin declares. (What the real
// blocks-core package declares, read through an installation of it alone, is proved in `packages/blocks-core/src/plugin.spec.ts`.)
jest.mock("@nivo-lite/plugin-registry", () => {
    const sdk: typeof import("@nivo-lite/agent-sdk/installation") = jest.requireActual("@nivo-lite/agent-sdk/installation")
    const base: typeof import("@tests/fixtures/builders/base-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/base-plugin.builder",
    )
    return { installed: sdk.defineInstallation([base.BASE_PLUGIN], "core-only") }
})

describe("a plugin removed from the array is removed from everything the engine reads", () => {
    it("holds no agent, tool, node, template, catalogue module or words of the removed plugin", () => {
        expect(INSTALLED.plugins.map((plugin) => plugin.key)).toEqual(["core"])
        expect(INSTALLED.agentOf(FIXTURE_MODULE)).toBeNull()
        expect(INSTALLED.agentToolsOf(FIXTURE_MODULE)).toBeNull()
        expect(INSTALLED.guidanceOf(FIXTURE_MODULE, "vi")).toBe("")
        expect(INSTALLED.abilityDefaultsOf(FIXTURE_MODULE)).toBeUndefined()
        expect(INSTALLED.templatesOf(FIXTURE_MODULE)).toEqual([])
        expect(INSTALLED.templateOf(FIXTURE_PRIMARY.id)).toBeNull()
        expect(INSTALLED.templateOf(FIXTURE_SECONDARY.id)).toBeNull()
        expect(INSTALLED.toolLabelOf(FIXTURE_TOOL)).toBeNull()
        expect(INSTALLED.nodeModelOf("fixdesk.intake")).toBeNull()
        expect(INSTALLED.nodeInstall().words?.("fixdeskTicketOpen")).toBeUndefined()
        const installed = nodeIndexOf(INSTALLED.nodeInstall())
        expect(installed.nodes.has("fixdesk.intake")).toBe(false)
        expect(installed.effects.has(FIXTURE_TOOL)).toBe(false)
        expect(MODULE_CATALOG.map((module) => module.key)).not.toContain(FIXTURE_MODULE)
        // A workflow of the removed plugin is refused: its step is no installed node.
        expect(() => requireSoundFlow(FIXTURE_PRIMARY.versions[0]!.graph, installed)).toThrow()
    })

    it("reads the first plugin's declarations through the array exactly as the plugin declares them", () => {
        // The first plugin's workflow templates are its template agents' graphs (one template per graph, id = the graph's key), nothing else.
        const agents = INSTALLED.templateAgents()
        for (const agent of BASE_PLUGIN.templateAgents ?? []) expect(agents).toContainEqual(agent)
        expect(INSTALLED.templates().map((template) => template.id)).toEqual(
            agents.flatMap((agent) => agent.graphs.map((graph) => graph.key)),
        )
        // The installed tools are the plugin's own definitions, the very objects it declares, then the ENGINE's (`NATIVE_TOOL_DEFINITIONS`),
        // which belong to no plugin and stay whatever the array holds. Compared by id and by identity (a deep compare walks whole zod objects).
        const install = INSTALLED.nodeInstall()
        const pluginTools = BASE_PLUGIN.tools ?? []
        const idsOf = (tools: ReadonlyArray<{ readonly id: string }>): ReadonlyArray<string> => tools.map((tool) => tool.id)
        expect(idsOf(install.tools)).toEqual([...idsOf(pluginTools), ...idsOf(NATIVE_TOOL_DEFINITIONS)])
        expect(install.tools.filter((tool) => !NATIVE_TOOL_DEFINITIONS.includes(tool))).toEqual(pluginTools)
        expect(install.tools.filter((tool) => NATIVE_TOOL_DEFINITIONS.includes(tool))).toEqual(NATIVE_TOOL_DEFINITIONS)
        expect(install).toEqual({
            nodes: BASE_PLUGIN.nodes,
            effects: BASE_PLUGIN.effects,
            tools: install.tools,
            dataKinds: BASE_PLUGIN.dataKinds,
            words: expect.any(Function),
        })
        expect(INSTALLED.nodeInstall().words?.("baseNoteRead")).toBe(BASE_PLUGIN.words?.("baseNoteRead"))
        expect(INSTALLED.nodeInstall().words?.("baseNoteRead")).toBeDefined()
        for (const tool of Object.keys(BASE_PLUGIN.toolLabels ?? {})) expect(INSTALLED.toolLabelOf(tool)).toBe(BASE_PLUGIN.toolLabels?.[tool])
        for (const module of BASE_PLUGIN.modules ?? []) {
            expect(INSTALLED.agentOf(module.key)).toBe(module.agent ?? null)
            expect(INSTALLED.guidanceOf(module.key, "vi")).toBe(BASE_PLUGIN.guidance?.(module.key, "vi"))
            expect(INSTALLED.guidanceOf(module.key, "en")).toBe(BASE_PLUGIN.guidance?.(module.key, "en"))
            expect(INSTALLED.isOpenTo(module.key, null)).toBe(true)
        }
    })
})
