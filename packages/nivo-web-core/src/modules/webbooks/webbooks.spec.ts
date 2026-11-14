import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import { moduleListProblems } from "@nivo-lite/agent-sdk/module"
import { TOOL, type ToolId, type ToolNames } from "@nivo-lite/agent-sdk/names"
import { corePlugin } from "@nivo-lite/blocks-core"
import { plugin } from "../../plugin"
import { CRM_NIVOWEB } from "../../crm/nivoweb/api.generated"
import en from "./messages/en.json"
import vi from "./messages/vi.json"
import {
    WEBBOOKS,
    WEBBOOKS_BUNDLE,
    WEBBOOKS_MESSAGES,
    WEBBOOKS_NODE_MODELS,
    WEBBOOKS_SERVER,
    WEBBOOKS_TEMPLATE,
    WEBBOOKS_TOOLS,
    webbooksAgent,
    webbooksGuidanceOf,
    webbooksModule,
} from "./index"

/*
 * The Accounting module as the plugin ships it after the flip: its declaration, its catalogue template, its bundle and its words. Its
 * graphs and nodes are judged where they live (`template/webbooks.agent.spec.ts`, `nodes/webbooks/webbooks-nodes.spec.ts`), the accounts
 * of its nodes in `node-accounts.spec.ts`, its hand-offs in `handoffs.spec.ts`.
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

describe("the Accounting agent's bundle", () => {
    it("hands the plugin one bundle in the shape of AgentBundle, holding this module only", () => {
        expect(Object.keys(WEBBOOKS_BUNDLE).sort()).toEqual([
            "agent",
            "guidance",
            "messages",
            "module",
            "nodeModels",
            "server",
        ])
        expect(WEBBOOKS_BUNDLE.module).toBe(webbooksModule)
        expect(WEBBOOKS_BUNDLE.server).toBe(WEBBOOKS_SERVER)
        expect(WEBBOOKS_BUNDLE.agent).toBe(webbooksAgent)
        expect(WEBBOOKS_BUNDLE.nodeModels).toBe(WEBBOOKS_NODE_MODELS)
        expect(WEBBOOKS_BUNDLE.guidance).toBe(webbooksGuidanceOf)
        expect(WEBBOOKS_BUNDLE.messages).toBe(WEBBOOKS_MESSAGES)
    })
})

describe("the Accounting agent composed with the core package", () => {
    it("joins with no id declared twice and names in its set only tools the installation knows", () => {
        expect(installed.modules.filter((module) => module.key === WEBBOOKS)).toHaveLength(1)
        expect(installed.templateAgents.filter((agent) => agent.key === WEBBOOKS)).toHaveLength(1)
        expect(WEBBOOKS_TOOLS.filter((id) => !known(id))).toEqual([])
        expect(webbooksModule.agent?.tools).toEqual(WEBBOOKS_TOOLS)
    })

    it("writes the CRM's money records, the invoice, the mail drafts a person sends, the team post and a truth proposal; no customer channel", () => {
        expect(WEBBOOKS_TOOLS.filter(writes).sort()).toEqual(
            [
                CRM_NIVOWEB.post_invoice_drafts,
                TOOL.invoiceCreate,
                CRM_NIVOWEB.post_renewals_id_payments,
                CRM_NIVOWEB.post_purchases_id_payments,
                CRM_NIVOWEB.post_receivables_code_notices,
                CRM_NIVOWEB.post_payables_party_code_notes,
                TOOL.mailMessageSend,
                TOOL.teamMessagePost,
                TOOL.brainChangePropose,
            ].sort(),
        )
        expect(WEBBOOKS_TOOLS).not.toContain(TOOL.customerMessageSend)
        expect(Object.keys(webbooksModule.agent ?? {})).toEqual(["tools"])
    })

    it("works under short guidance in both languages that sends it to the truths first", () => {
        expect(installed.guidanceOf(WEBBOOKS, "vi")).toContain(vi.guidance)
        expect(installed.guidanceOf(WEBBOOKS, "en")).toContain(en.guidance)
        expect(en.guidance).toMatch(/truths/u)
        expect(en.guidance.length).toBeLessThan(700)
        expect(installed.guidanceOf("sales", "en")).not.toContain(en.guidance)
    })

    it("holds the same copy keys in both languages", () => {
        expect(Object.keys(en).sort()).toEqual(Object.keys(vi).sort())
    })
})

describe("the Accounting catalogue template", () => {
    it("is a module list the host may load, under the module's own key", () => {
        expect(moduleListProblems([WEBBOOKS_SERVER])).toEqual([])
        expect(WEBBOOKS_TEMPLATE.key).toMatch(/^[a-z][a-z0-9_]{1,23}$/u)
    })

    it("meets the catalogue's own rules: gates in both languages", () => {
        expect(
            WEBBOOKS_TEMPLATE.gates.every((gate) =>
                [gate.key, gate.label_vi, gate.label_en, gate.hint_vi, gate.hint_en].every(
                    (text) => text.trim() !== "",
                ),
            ),
        ).toBe(true)
        expect(WEBBOOKS_TEMPLATE.gates.flatMap((gate) => gate.writes ?? [])).toEqual([])
        expect(WEBBOOKS_TEMPLATE.audience).toBe("internal")
        expect(WEBBOOKS_TEMPLATE.category).toBe("finance")
    })
})
