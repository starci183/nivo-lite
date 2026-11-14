import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import { moduleListProblems } from "@nivo-lite/agent-sdk/module"
import { TOOL, type ToolId, type ToolNames } from "@nivo-lite/agent-sdk/names"
import { corePlugin } from "@nivo-lite/blocks-core"
import { plugin } from "../../plugin"
import { CRM_NIVOWEB } from "../../crm/nivoweb/api.generated"
import en from "./messages/en.json"
import vi from "./messages/vi.json"
import {
    WEBDESK,
    WEBDESK_MESSAGES,
    WEBDESK_NODE_MODELS,
    WEBDESK_SERVER,
    WEBDESK_TEMPLATE,
    WEBDESK_TOOLS,
    webdesk,
    webdeskAgent,
    webdeskModule,
} from "./index"

/*
 * The Support module as the plugin ships it after the flip: its declaration, its catalogue template, its bundle and its words. Its
 * graphs and nodes are judged where they live (`template/webdesk.agent.spec.ts`, `nodes/webdesk/webdesk-nodes.spec.ts`), the accounts of
 * its nodes in `node-accounts.spec.ts`, its hand-offs in `handoffs.spec.ts`.
 */

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

describe("the Support agent composed with the core package and the other NIVO Web agents", () => {
    it("joins with no id declared twice", () => {
        expect(installed.modules.filter((module) => module.key === WEBDESK)).toHaveLength(1)
        expect(installed.templateAgents.filter((agent) => agent.key === WEBDESK)).toHaveLength(1)
    })

    it("hands the plugin one bundle in the shape of AgentBundle, holding this module only", () => {
        expect(Object.keys(webdesk).sort()).toEqual(["agent", "guidance", "messages", "module", "nodeModels", "server"])
        expect([webdesk.module, webdesk.server, webdesk.agent, webdesk.nodeModels, webdesk.messages]).toEqual([
            webdeskModule,
            WEBDESK_SERVER,
            webdeskAgent,
            WEBDESK_NODE_MODELS,
            WEBDESK_MESSAGES,
        ])
        expect(webdeskAgent.key).toBe(WEBDESK)
    })

    it("names in its agent's set only tools the installation knows", () => {
        expect(WEBDESK_TOOLS.filter((id) => !known(id))).toEqual([])
        expect(webdeskModule.agent?.tools).toEqual(WEBDESK_TOOLS)
    })

    it("faces customers but acts on no host, site, renewal or money: its writes are the messages, the mail, a truth proposal and CRM tickets", () => {
        expect(WEBDESK_TOOLS.filter(writes).sort()).toEqual(
            [
                TOOL.customerMessageSend,
                TOOL.teamMessagePost,
                TOOL.mailMessageSend,
                TOOL.brainChangePropose,
                CRM_NIVOWEB.post_customers_code_contacts,
                CRM_NIVOWEB.post_tickets,
                CRM_NIVOWEB.patch_tickets_id,
            ].sort(),
        )
        expect(WEBDESK_TEMPLATE.audience).toBe("customer")
    })

    it("holds no limit: its policy is words only", () => {
        expect(Object.keys(webdeskModule.agent ?? {})).toEqual(["tools"])
    })

    it("works under guidance in both languages that sends it to the truths and forbids acting on a site or promising one", () => {
        expect(installed.guidanceOf(WEBDESK, "vi")).toContain(vi.guidance)
        expect(installed.guidanceOf(WEBDESK, "en")).toContain(en.guidance)
        expect(en.guidance).toMatch(/truths/u)
        expect(en.guidance).toMatch(/Never act on a customer's hosting/u)
        expect(installed.guidanceOf("webmail", "en")).not.toContain(en.guidance)
    })

    it("holds the same copy keys in both languages", () => {
        expect(Object.keys(en).sort()).toEqual(Object.keys(vi).sort())
    })
})

describe("the Support catalogue template", () => {
    it("is a module list the host may load, under the module's own key, with no clock", () => {
        expect(moduleListProblems([{ key: WEBDESK, template: WEBDESK_TEMPLATE }])).toEqual([])
        expect(WEBDESK_TEMPLATE.key).toMatch(/^[a-z][a-z0-9_]{1,23}$/u)
        expect(WEBDESK_TEMPLATE.triggers).toBeUndefined()
    })

    it("meets the catalogue's own rules: gates in both languages", () => {
        expect(
            WEBDESK_TEMPLATE.gates.every((gate) =>
                [gate.key, gate.label_vi, gate.label_en, gate.hint_vi, gate.hint_en].every(
                    (text) => text.trim() !== "",
                ),
            ),
        ).toBe(true)
        expect(WEBDESK_TEMPLATE.gates.flatMap((gate) => gate.writes ?? [])).toEqual([])
    })
})
