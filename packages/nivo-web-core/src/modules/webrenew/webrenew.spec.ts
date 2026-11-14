import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import { moduleListProblems } from "@nivo-lite/agent-sdk/module"
import { TOOL, type ToolId, type ToolNames } from "@nivo-lite/agent-sdk/names"
import { corePlugin } from "@nivo-lite/blocks-core"
import { plugin } from "../../plugin"
import { CRM_NIVOWEB } from "../../crm/nivoweb/api.generated"
import en from "./messages/en.json"
import vi from "./messages/vi.json"
import {
    TARGETS,
    WEBRENEW,
    WEBRENEW_BUNDLE,
    WEBRENEW_MESSAGES,
    WEBRENEW_NODE_MODELS,
    WEBRENEW_SERVER,
    WEBRENEW_TEMPLATE,
    WEBRENEW_TOOLS,
    webrenewAgent,
    webrenewModule,
} from "./index"

/*
 * The Renewal module as the plugin ships it after the flip: its declaration, its catalogue template, its bundle and its words. Its
 * graphs and nodes are judged where they live (`template/webrenew.agent.spec.ts`, `nodes/webrenew/webrenew-nodes.spec.ts`), the accounts
 * of its nodes in `node-accounts.spec.ts`, its hand-offs in `handoffs.spec.ts`.
 */

/** The prefix of every tool the CRM source serves (its source key under the tool level). */
const CRM_NAMESPACE = "nivo.api.crm.nivoweb."

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

describe("the Renewal agent composed with the core package", () => {
    it("joins the core package with no id declared twice", () => {
        expect(installed.modules.filter((module) => module.key === WEBRENEW)).toHaveLength(1)
        expect(installed.templateAgents.filter((agent) => agent.key === WEBRENEW)).toHaveLength(1)
        expect(installed.plugins.map((one) => one.key)).toEqual(["core", "nivo-web-core"])
    })

    it("hands the plugin one bundle in the shape of AgentBundle, holding this module only", () => {
        expect(Object.keys(WEBRENEW_BUNDLE).sort()).toEqual([
            "agent",
            "guidance",
            "messages",
            "module",
            "nodeModels",
            "server",
        ])
        expect([
            WEBRENEW_BUNDLE.module,
            WEBRENEW_BUNDLE.server,
            WEBRENEW_BUNDLE.agent,
            WEBRENEW_BUNDLE.nodeModels,
            WEBRENEW_BUNDLE.messages,
        ]).toEqual([webrenewModule, WEBRENEW_SERVER, webrenewAgent, WEBRENEW_NODE_MODELS, WEBRENEW_MESSAGES])
    })

    it("names in its agent's set only tools the installation knows, the CRM ones by their generated id", () => {
        expect(WEBRENEW_TOOLS.filter((id) => !known(id))).toEqual([])
        expect(webrenewModule.agent?.tools).toEqual(WEBRENEW_TOOLS)
        expect(WEBRENEW_TOOLS.filter((id) => id.startsWith(CRM_NAMESPACE)).filter((id) => !tools.has(id))).toEqual([])
    })

    it("writes the customer send, the mail, the team post, a truth proposal and CRM records: no bank, ledger or order tool", () => {
        expect(WEBRENEW_TOOLS.filter(writes).sort()).toEqual(
            [
                TOOL.customerMessageSend,
                TOOL.mailMessageSend,
                TOOL.teamMessagePost,
                TOOL.brainChangePropose,
                CRM_NIVOWEB.post_services_code_reminders,
                CRM_NIVOWEB.post_services_code_renewals,
                CRM_NIVOWEB.post_renewals,
            ].sort(),
        )
        expect(
            WEBRENEW_TOOLS.some(
                (id) =>
                    id.startsWith("nivo.tool.payment.") ||
                    id.startsWith("nivo.tool.ledger.") ||
                    id.startsWith("nivo.tool.order."),
            ),
        ).toBe(false)
        expect(Object.keys(webrenewModule.agent ?? {})).toEqual(["tools"])
    })

    it("hands the paid renewal to Accounting's invoice", () => {
        expect(TARGETS).toEqual({ books: "webbooks", payment: "payment", invoice: "invoice" })
    })

    it("works under guidance in both languages that sends it to the truths and to the founder when the rules or prices are missing", () => {
        expect(installed.guidanceOf(WEBRENEW, "vi")).toContain(vi.guidance)
        expect(installed.guidanceOf(WEBRENEW, "en")).toContain(en.guidance)
        expect(en.guidance).toMatch(/truths/u)
        expect(en.guidance).toMatch(/renewal rules or the price list are missing/u)
        expect(en.guidance).toMatch(/\/chat/u)
        expect(en.guidance.length).toBeLessThan(1000)
        expect(installed.guidanceOf("sales", "en")).not.toContain(en.guidance)
    })

    it("holds the same copy keys in both languages, and words and a label for every CRM tool it names", () => {
        expect(Object.keys(en).sort()).toEqual(Object.keys(vi).sort())
        for (const id of WEBRENEW_TOOLS.filter((one) => one.startsWith(CRM_NAMESPACE))) {
            const title = tools.get(id)?.title
            expect(title !== undefined && "key" in title ? installed.wordsOf(title.key) : undefined).toEqual(
                expect.any(String),
            )
            expect(installed.toolLabels[id]?.kind).toBe(tools.get(id)?.mutates === true ? "acts" : "reads")
        }
    })
})

describe("the Renewal catalogue template", () => {
    it("is a module list the host may load, under the module's own key", () => {
        expect(moduleListProblems([{ key: WEBRENEW, template: WEBRENEW_TEMPLATE }])).toEqual([])
        expect(WEBRENEW_TEMPLATE.key).toMatch(/^[a-z][a-z0-9_]{1,23}$/u)
    })

    it("meets the catalogue's rules: gates in both languages", () => {
        expect(
            WEBRENEW_TEMPLATE.gates.every((gate) =>
                [gate.key, gate.label_vi, gate.label_en, gate.hint_vi, gate.hint_en].every(
                    (text) => text.trim() !== "",
                ),
            ),
        ).toBe(true)
        expect(WEBRENEW_TEMPLATE.gates.flatMap((gate) => gate.writes ?? [])).toEqual([])
        expect(WEBRENEW_TEMPLATE.audience).toBe("customer")
    })
})
