import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConversationContactsService } from "@modules/domain/contacts"
import { INSTALLED } from "@modules/domain/installed-plugins"
import type { ContextResult } from "@modules/domain/context-sources"
import { ToolsErrorCode } from "@modules/domain/tools"
import type { NativeCaller } from "@modules/domain/tools"
import { NivoNativeService } from "./nivo-native.service"
import { NativeViewService } from "./native-view.service"
import { PluginToolsNativeService, pluginToolManifestsOf } from "./plugin-tools-native.service"
import type { NativeView } from "./native-view.policy"

const WS = "ws-1"
const RESULT: ContextResult = { notice: "n", source: "nivo.tool.lead", asOf: "2026-11-11T00:00:00.000Z", facts: [] }
const VIEW: NativeView = { workspaceId: WS, module: "sales", audience: "customer", installationId: null, searchable: true }
const STEP: NativeCaller = { agentId: "agent-1", conversationId: "conv-1", graphStep: true }

const build = async () => {
    // conv-1 is a route: the contact it reaches is the engine's own answer, whichever agent asks.
    const contacts = mock<ConversationContactsService>()
    contacts.contactOf.mockImplementation((_ws, id) => Promise.resolve(id === "conv-1" ? "contact-1" : null))
    const views = mock<NativeViewService>()
    views.of.mockResolvedValue(VIEW)
    // The tools the installation's plugins serve: the sample the connector lists and routes (the plugin part is a mock, as a read of the records is).
    const plugins = mock<PluginToolsNativeService>({ tools: pluginToolManifestsOf(INSTALLED) })
    plugins.serves.mockImplementation((tool) => plugins.tools.some((spec) => spec.name === tool))
    plugins.read.mockImplementation((_workspaceId, tool) => Promise.resolve(tool === "lead.order.list" ? { ...RESULT } : { orders: [] }))
    const moduleRef = await Test.createTestingModule({
        providers: [
            NivoNativeService,
            { provide: ConversationContactsService, useValue: contacts },
            { provide: NativeViewService, useValue: views },
            { provide: PluginToolsNativeService, useValue: plugins },
        ],
    }).compile()
    return { nivo: moduleRef.get(NivoNativeService), views, plugins, contacts }
}

describe("NivoNativeService: the connector", () => {
    it("lists the context reads under the public prefix `nivo.tool`, its row key its own", async () => {
        const { nivo } = await build()

        expect(nivo.manifest).toMatchObject({ key: "nivo-context", namespace: "nivo.tool" })
        expect(nivo.manifest.tools.map((spec) => [spec.name, spec.scope])).toEqual([
            ["lead.order.list", "read"],
            ["order.get", "read"],
            ["order.open.list", "read"],
            ["payment.claim.list", "read"],
            ["lead.care.get", "read"],
        ])
        for (const spec of nivo.manifest.tools) {
            expect(JSON.stringify(spec.inputSchema)).not.toMatch(/conversationId|leadId/u)
        }
    })
})

describe("NivoNativeService: the sales reads", () => {
    it("hands a plugin read the locked subject and the caller's audience", async () => {
        const { nivo, plugins } = await build()

        await expect(nivo.invoke(WS, "order.open.list", {}, STEP)).resolves.toEqual({ orders: [] })
        expect(plugins.read).toHaveBeenCalledWith(WS, "order.open.list", {}, { conversationId: "conv-1", contactId: "contact-1", leadId: null }, "customer", "agent-1")
    })

    it("refuses a sales read naming another person or lead before it runs", async () => {
        const { nivo, plugins } = await build()

        await expect(nivo.invoke(WS, "lead.care.get", { contactId: "contact-9" }, STEP)).rejects.toMatchObject({
            params: { reason: "other_contact" },
        })
        await expect(nivo.invoke(WS, "lead.care.get", { leadId: "lead-9" }, { agentId: "agent-1", conversationId: "conv-1" })).rejects.toMatchObject({
            params: { reason: "other_lead" },
        })
        expect(plugins.read).not.toHaveBeenCalled()
    })
})

describe("NivoNativeService: hard-locked to the run's own conversation and person", () => {
    it("reads the person the caller's conversation names, for the caller's audience", async () => {
        const { nivo, plugins } = await build()

        await expect(nivo.invoke(WS, "lead.order.list", { limit: 3 }, STEP)).resolves.toEqual(RESULT)
        expect(plugins.read).toHaveBeenCalledWith(WS, "lead.order.list", { limit: 3 }, { conversationId: "conv-1", contactId: "contact-1", leadId: null }, "customer", "agent-1")
    })

    it("refuses another conversation or another customer before any record is read", async () => {
        const { nivo, plugins } = await build()

        await expect(nivo.invoke(WS, "lead.order.list", { conversationId: "conv-9" }, STEP)).rejects.toMatchObject({
            code: ToolsErrorCode.NativeRefused,
            params: { reason: "other_conversation" },
        })
        await expect(nivo.invoke(WS, "lead.order.list", { contactId: "contact-9" }, STEP)).rejects.toMatchObject({
            params: { reason: "other_contact" },
        })
        expect(plugins.read).not.toHaveBeenCalled()
    })

    it("takes the door's person for a step with no conversation; any other caller with no conversation reads no person", async () => {
        const { nivo, plugins } = await build()
        const bankFed: NativeCaller = { agentId: "agent-1", conversationId: null, graphStep: true }
        const surface: NativeCaller = { agentId: "agent-1", conversationId: null }

        await nivo.invoke(WS, "lead.order.list", { contactId: "contact-7", leadId: "lead-7" }, bankFed)
        await expect(nivo.invoke(WS, "lead.order.list", { contactId: "contact-7" }, surface)).rejects.toMatchObject({
            params: { reason: "other_contact" },
        })
        await nivo.invoke(WS, "lead.order.list", {}, surface)

        expect(plugins.read.mock.calls.map((call) => call[3])).toEqual([
            { conversationId: null, contactId: "contact-7", leadId: "lead-7" },
            { conversationId: null, contactId: null, leadId: null },
        ])
    })

    it("does not serve the thread read: the engine's own family does (owner ruling R26), and refuses a tool it does not have", async () => {
        const { nivo, plugins } = await build()

        await expect(nivo.invoke(WS, "conversation.message.list", {}, STEP)).rejects.toBeDefined()
        await expect(nivo.invoke(WS, "lead.secret.list", {}, STEP)).rejects.toBeDefined()
        expect(plugins.read).not.toHaveBeenCalled()
    })
})

describe("NivoNativeService: a plugin read is made for the calling agent", () => {
    it("hands the CALLING agent to the plugin: another agent's step on the same route reads for that agent, its person the route's", async () => {
        const { nivo, plugins, contacts } = await build()
        // The sales agent a hand-off woke on the route: the door filled the run's own contact from the run token.
        const sales: NativeCaller = { agentId: "agent-2", conversationId: "conv-1", graphStep: true }

        await nivo.invoke(WS, "lead.order.list", { contactId: "contact-1" }, sales)

        expect(contacts.contactOf).toHaveBeenCalledWith(WS, "conv-1")
        expect(plugins.read).toHaveBeenCalledWith(
            WS,
            "lead.order.list",
            { contactId: "contact-1" },
            { conversationId: "conv-1", contactId: "contact-1", leadId: null },
            "customer",
            "agent-2",
        )
    })
})
