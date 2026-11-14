import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import { moduleListProblems } from "@nivo-lite/agent-sdk/module"
import { TOOL, type ToolId, type ToolNames } from "@nivo-lite/agent-sdk/names"
import { corePlugin } from "@nivo-lite/blocks-core"
import { plugin } from "../../plugin"
import { CRM_NIVOWEB } from "../../crm/nivoweb/api.generated"
import en from "./messages/en.json"
import vi from "./messages/vi.json"
import {
    SALES_ROUND_TRIGGER,
    WEBSALES,
    WEBSALES_MESSAGES,
    WEBSALES_NODE_MODELS,
    WEBSALES_SERVER,
    WEBSALES_TEMPLATE,
    WEBSALES_TOOLS,
    websales,
    websalesAgent,
    websalesModule,
} from "./index"

/*
 * The Sales module as the plugin ships it after the flip: its declaration, its catalogue template, its bundle and its words. Its graphs
 * and nodes are judged where they live (`template/websales.agent.spec.ts`, `nodes/websales/websales-nodes.spec.ts`), the accounts of its
 * nodes in `node-accounts.spec.ts`, its hand-offs in `handoffs.spec.ts`.
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

describe("the Sales agent composed with the core package and the other NIVO Web agents", () => {
    it("joins with no id declared twice", () => {
        expect(installed.modules.filter((module) => module.key === WEBSALES)).toHaveLength(1)
        expect(installed.templateAgents.filter((agent) => agent.key === WEBSALES)).toHaveLength(1)
    })

    it("hands the plugin one bundle in the shape of AgentBundle, holding this module only", () => {
        expect(Object.keys(websales).sort()).toEqual([
            "agent",
            "guidance",
            "messages",
            "module",
            "nodeModels",
            "server",
        ])
        expect([websales.module, websales.server, websales.agent, websales.nodeModels, websales.messages]).toEqual([
            websalesModule,
            WEBSALES_SERVER,
            websalesAgent,
            WEBSALES_NODE_MODELS,
            WEBSALES_MESSAGES,
        ])
    })

    it("names in its agent's set only tools the installation knows", () => {
        expect(WEBSALES_TOOLS.filter((id) => !known(id))).toEqual([])
        expect(websalesModule.agent?.tools).toEqual(WEBSALES_TOOLS)
    })

    it("writes only messages, mails, the customer link and the CRM's purchases and customers: no renewal, invoice, ticket or money record", () => {
        expect(WEBSALES_TOOLS.filter(writes).sort()).toEqual(
            [
                TOOL.customerMessageSend,
                TOOL.mailMessageSend,
                TOOL.teamMessagePost,
                TOOL.brainChangePropose,
                TOOL.contactIdentityLink,
                CRM_NIVOWEB.post_customers,
                CRM_NIVOWEB.post_purchases,
                CRM_NIVOWEB.patch_purchases_id,
                CRM_NIVOWEB.post_purchases_id_quotes,
                CRM_NIVOWEB.post_purchases_id_followups,
                CRM_NIVOWEB.post_purchases_id_acceptance,
            ].sort(),
        )
        expect(WEBSALES_TEMPLATE.audience).toBe("customer")
        expect(Object.keys(websalesModule.agent ?? {})).toEqual(["tools"])
    })

    it("works under its own guidance in both languages, with the same copy keys in both", () => {
        expect(installed.guidanceOf(WEBSALES, "vi")).toContain(vi.guidance)
        expect(installed.guidanceOf(WEBSALES, "en")).toContain(en.guidance)
        expect(installed.guidanceOf("webdesk", "en")).not.toContain(en.guidance)
        expect(Object.keys(en).sort()).toEqual(Object.keys(vi).sort())
    })
})

describe("the Sales catalogue template", () => {
    it("is a module list the host may load, under the module's own key, with its one clock", () => {
        expect(moduleListProblems([{ key: WEBSALES, template: WEBSALES_TEMPLATE }])).toEqual([])
        expect(WEBSALES_TEMPLATE.key).toMatch(/^[a-z][a-z0-9_]{1,23}$/u)
        expect(WEBSALES_TEMPLATE.triggers).toEqual([SALES_ROUND_TRIGGER])
    })

    it("meets the catalogue's own rules: gates in both languages", () => {
        expect(
            WEBSALES_TEMPLATE.gates.every((gate) =>
                [gate.key, gate.label_vi, gate.label_en, gate.hint_vi, gate.hint_en].every(
                    (text) => text.trim() !== "",
                ),
            ),
        ).toBe(true)
    })
})
