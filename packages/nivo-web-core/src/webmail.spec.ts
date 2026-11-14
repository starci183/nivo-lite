import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import { moduleListProblems } from "@nivo-lite/agent-sdk/module"
import { TOOL, type ToolId, type ToolNames } from "@nivo-lite/agent-sdk/names"
import { corePlugin } from "@nivo-lite/blocks-core"
import en from "./modules/webmail/messages/en.json"
import vi from "./modules/webmail/messages/vi.json"
import {
    WEBMAIL,
    WEBMAIL_BUNDLE,
    WEBMAIL_TEMPLATE,
    WEBMAIL_TOOLS,
    webmailAgent,
    webmailModule,
} from "./modules/webmail"
import { plugin } from "./plugin"

/*
 * The Mailbox module as the plugin ships it after the flip: its declaration, its catalogue template, its bundle and its words. Its graphs
 * and nodes are judged where they live (`modules/webmail/template/webmail.agent.spec.ts`, `nodes/webmail/webmail-nodes.spec.ts`), the
 * accounts of its nodes in `node-accounts.spec.ts`, its hand-offs in `handoffs.spec.ts`.
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

describe("the Mailbox agent composed with the core package", () => {
    it("joins the core package with no id declared twice", () => {
        expect(installed.plugins.map((one) => one.key)).toEqual(["core", "nivo-web-core"])
        expect(installed.modules.filter((module) => module.key === WEBMAIL)).toHaveLength(1)
        expect(installed.templateAgents.filter((agent) => agent.key === WEBMAIL)).toEqual([webmailAgent])
        expect(WEBMAIL_BUNDLE.agent).toBe(webmailAgent)
    })

    it("names in its agent's set only tools the installation knows", () => {
        expect(WEBMAIL_TOOLS.filter((id) => !known(id))).toEqual([])
        expect(webmailModule.agent?.tools).toEqual(WEBMAIL_TOOLS)
    })

    it("is staff-only: no customer send, no money, no CRM, no write beyond the team post and a truth proposal", () => {
        expect(WEBMAIL_TOOLS.filter(writes).sort()).toEqual([TOOL.brainChangePropose, TOOL.teamMessagePost].sort())
        expect(WEBMAIL_TOOLS.filter((id) => id.startsWith("nivo.api.crm.") || id.startsWith("nivo-web."))).toEqual([])
        expect(webmailAgent.accounts).toEqual(["imap"])
        expect(WEBMAIL_TEMPLATE.audience).toBe("internal")
    })

    it("holds by default only mail reads on the IMAP account, each ticked auto (derived from its node steps, not declared)", () => {
        expect(webmailModule.agent?.abilities).toBeUndefined()
        const steps = webmailAgent.graphs.flatMap((graph) =>
            graph.spec.nodes.flatMap((step) =>
                step.kind === "node" ? [{ step, tools: graph.nodes.get(step.step)?.tools ?? [] }] : [],
            ),
        )
        // ledger 2026-11-13 (`nivo-frame.rights`: one mode per node, NIVO itself never listed): the staff-only writes are NIVO's own
        // steps (no provider), only those writes, never another; the steps on an account act through IMAP alone, `auto`, and read mail.
        const staffWrites: ReadonlyArray<string> = [TOOL.brainChangePropose, TOOL.teamMessagePost]
        const own = steps.filter(({ step }) => step.accounts.length === 0)
        expect(own.every(({ tools }) => tools.every((id) => !id.startsWith("nivo.tool.mail.")))).toBe(true)
        expect(own.flatMap(({ tools }) => tools).filter((id) => staffWrites.includes(id)).length).toBeGreaterThan(0)
        const onAccounts = steps.filter(({ step }) => step.accounts.length > 0)
        expect([...new Set(onAccounts.flatMap(({ step }) => step.accounts))]).toEqual(["imap"])
        expect([...new Set(onAccounts.map(({ step }) => step.mode))]).toEqual(["auto"])
        expect([...new Set(onAccounts.flatMap(({ tools }) => tools).filter((id) => id.startsWith("nivo.tool.mail.")))].sort()).toEqual(
            [TOOL.mailMessageGet, TOOL.mailMessageList].sort(),
        )
        expect(Object.keys(webmailModule.agent ?? {})).toEqual(["tools"])
    })

    it("works under short guidance in both languages that sends it to the truths first", () => {
        expect(installed.guidanceOf(WEBMAIL, "vi")).toContain(vi.guidance)
        expect(installed.guidanceOf(WEBMAIL, "en")).toContain(en.guidance)
        expect(en.guidance).toMatch(/truths/u)
        expect(en.guidance.length).toBeLessThan(700)
        expect(installed.guidanceOf("sales", "en")).not.toContain(en.guidance)
    })

    it("gives the model words for the title of each tool it installs", () => {
        for (const tool of plugin.tools ?? []) {
            const title = tool.title
            expect("key" in title ? installed.wordsOf(title.key) : title.en).toEqual(expect.any(String))
        }
    })

    it("holds the same copy keys in both languages", () => {
        expect(Object.keys(en).sort()).toEqual(Object.keys(vi).sort())
    })
})

describe("the Mailbox catalogue template", () => {
    it("is a module list the host may load, under the module's own key, on its every-15-minutes clock", () => {
        expect(moduleListProblems([{ key: WEBMAIL, template: WEBMAIL_TEMPLATE }])).toEqual([])
        expect(WEBMAIL_TEMPLATE.key).toMatch(/^[a-z][a-z0-9_]{1,23}$/u)
        expect(WEBMAIL_TEMPLATE.triggers).toEqual([{ key: "mail-round", preset: "every_15m" }])
    })

    it("meets the catalogue's own rules: gates in both languages", () => {
        expect(WEBMAIL_TEMPLATE.gates.length).toBeGreaterThan(0)
        expect(
            WEBMAIL_TEMPLATE.gates.every((gate) =>
                [gate.key, gate.label_vi, gate.label_en, gate.hint_vi, gate.hint_en].every(
                    (text) => text.trim() !== "",
                ),
            ),
        ).toBe(true)
        expect(WEBMAIL_TEMPLATE.gates.flatMap((gate) => gate.writes ?? [])).toEqual([])
        expect(["sales_customer", "operations", "finance", "marketing", "hr"]).toContain(WEBMAIL_TEMPLATE.category)
    })
})
