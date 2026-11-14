import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import { moduleListProblems } from "@nivo-lite/agent-sdk/module"
import { TOOL, type ToolId, type ToolNames } from "@nivo-lite/agent-sdk/names"
import { corePlugin } from "@nivo-lite/blocks-core"
import en from "./modules/webdocs/messages/en.json"
import vi from "./modules/webdocs/messages/vi.json"
import {
    WEBDOCS,
    WEBDOCS_BUNDLE,
    WEBDOCS_TEMPLATE,
    WEBDOCS_TOOLS,
    webdocsAgent,
    webdocsModule,
} from "./modules/webdocs"
import { plugin } from "./plugin"

/*
 * The Paperwork module as the plugin ships it after the flip: its declaration, its catalogue template, its bundle and its words. Its
 * graphs and nodes are judged where they live (`modules/webdocs/template/webdocs.agent.spec.ts`, `nodes/webdocs/webdocs-nodes.spec.ts`),
 * the accounts of its nodes in `node-accounts.spec.ts`.
 */

/** The installation the engine is wired from, the core package first: this plugin composed with the core package. */
const installed = defineInstallation([corePlugin, plugin], "")
const tools = new Map<string, (typeof installed.tools)[number]>(installed.tools.map((tool) => [tool.id, tool]))
/** NIVO's own tools the engine serves (no package installs a definition of them). */
const NATIVE: ReadonlySet<string> = new Set(Object.values(TOOL))
/** A tool the installation knows: a definition a package installs, or one of NIVO's own. */
const known = (id: string): boolean => tools.has(id) || NATIVE.has(id)
/** The ids the SDK marks as asking (`ToolNames[K]["asks"]`): exactly the tools that write. */
type AskingId = { [K in ToolId]: ToolNames[K] extends { readonly asks: true } ? K : never }[ToolId]
/** NIVO's own writes that no definition or effect carries, each proved asking by tsc (no tool class exists). */
const OWN_WRITES: ReadonlySet<string> = new Set<AskingId>([TOOL.mailMessageSend, TOOL.contactIdentityLink])
/** The effects the installation carries: each one writes. */
const EFFECTS: ReadonlySet<string> = new Set(installed.effects.map((effect) => effect.id))
/** A tool that changes something: its definition mutates, it is an effect, or it is one of NIVO's own asking writes. */
const writes = (id: string): boolean => tools.get(id)?.mutates === true || EFFECTS.has(id) || OWN_WRITES.has(id)

describe("the Paperwork agent composed with the core package", () => {
    it("names in its agent's set only tools the installation knows, and ships one template agent of its key", () => {
        expect(WEBDOCS_TOOLS.filter((id) => !known(id))).toEqual([])
        expect(webdocsModule.agent?.tools).toEqual(WEBDOCS_TOOLS)
        expect(installed.templateAgents.filter((agent) => agent.key === WEBDOCS)).toEqual([webdocsAgent])
        expect(WEBDOCS_BUNDLE.agent).toBe(webdocsAgent)
    })

    it("is staff-only and read-only: its one write is the team post the draft goes back through", () => {
        expect(WEBDOCS_TOOLS.filter(writes)).toEqual([TOOL.teamMessagePost])
        expect(WEBDOCS_TEMPLATE.audience).toBe("internal")
        expect(Object.keys(webdocsModule.agent ?? {})).toEqual(["tools"])
    })

    it("is the beta agent, marked the way the catalogue marks one: early access, with no beta word in its name", () => {
        expect(WEBDOCS_TEMPLATE.status).toBe("early")
        expect([vi["agent.label"], en["agent.label"]].join(" ")).not.toMatch(/beta/iu)
    })

    it("works under short guidance in both languages: drafts only from what it read, files and signs nothing", () => {
        expect(installed.guidanceOf(WEBDOCS, "vi")).toContain(vi.guidance)
        expect(installed.guidanceOf(WEBDOCS, "en")).toContain(en.guidance)
        expect(en.guidance.length).toBeLessThan(700)
        expect(installed.guidanceOf("webmail", "en")).not.toContain(en.guidance)
    })

    it("holds the same copy keys in both languages", () => {
        expect(Object.keys(en).sort()).toEqual(Object.keys(vi).sort())
    })
})

describe("the Paperwork catalogue template", () => {
    it("is a module list the host may load, under the module's own key", () => {
        expect(moduleListProblems([{ key: WEBDOCS, template: WEBDOCS_TEMPLATE }])).toEqual([])
    })

    it("meets the catalogue's own rules: gates in both languages, no clock", () => {
        expect(
            WEBDOCS_TEMPLATE.gates.every((gate) =>
                [gate.key, gate.label_vi, gate.label_en, gate.hint_vi, gate.hint_en].every(
                    (text) => text.trim() !== "",
                ),
            ),
        ).toBe(true)
        expect(WEBDOCS_TEMPLATE.triggers ?? []).toEqual([])
    })
})
