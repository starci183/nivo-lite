import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import {
    PLUGIN_TOOLS,
    PLUGIN_TOOL_DECLARATIONS,
    type PluginToolCall,
    type PluginToolDeclaration,
    type PluginToolResult,
    type PluginTools,
} from "@nivo-lite/agent-sdk/plugin-tools"
import { defineService } from "@nivo-lite/agent-sdk/service"
import { z } from "zod"
import { CONTEXT_NOTICE } from "@modules/domain/context-sources"
import { EntityEngineError, EntityEngineErrorCode } from "@modules/domain/entity-engine"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { LeadMemoryService } from "@modules/domain/lead-memory"
import { PLUGIN_SERVICES, type PluginServicesApi } from "@modules/domain/plugin-services"
import { ToolsErrorCode } from "@modules/domain/tools"
import {
    PLUGIN_TOOL_SERVICES,
    PluginToolsNativeService,
    pluginToolManifestsOf,
    type PluginToolServices,
} from "./plugin-tools-native.service"

const WS = "ws-1"
const SUBJECT = { conversationId: "conv-1", contactId: "contact-1", leadId: "lead-1" } as const

/** A tool a fixture plugin declares: one read taking a record id, strict like every locked read. */
const DECLARATION: PluginToolDeclaration = {
    id: TOOL.orderGet,
    description: "One record by its id.",
    scope: "read",
    defaultMode: "auto",
    inputSchema: z.toJSONSchema(z.object({ orderId: z.string() }).strict(), { io: "input" }),
    argumentSchema: z.object({ orderId: z.string().min(1), contactId: z.string().optional() }).strict(),
    secretFields: ["note"],
}

/** The installed services of a fixture plugin that serves one tool for the module `shop`. */
const FIXTURE: PluginToolServices = {
    services: () => [
        defineService({
            id: "fixture.shop.plugin-tool-declarations",
            moduleKey: "shop",
            contract: PLUGIN_TOOL_DECLARATIONS,
            ports: {},
            build: () => ({ tools: [DECLARATION] }),
        }),
    ],
}

const build = async (options: { answer?: PluginToolResult; services?: boolean; memory?: boolean; missingAgent?: boolean } = {}) => {
    const tools = mock<PluginTools>()
    tools.call.mockResolvedValue(options.answer ?? { ok: true, value: { order: { id: "o1" } } })
    const services = mock<PluginServicesApi>()
    if (options.missingAgent === true) {
        services.forModule.mockRejectedValue(new EntityEngineError({ code: EntityEngineErrorCode.AgentMissing, params: { module: "shop", workspaceId: WS } }))
    } else {
        services.forModule.mockResolvedValue(tools as never)
    }
    const memory = mock<LeadMemoryService>()
    memory.snapshot.mockResolvedValue({
        subject: { key: "lead:lead-1", contactId: null, conversationId: "conv-1" },
        lead: { careOptOut: true },
        workflows: {},
    } as never)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PluginToolsNativeService,
            { provide: PLUGIN_TOOL_SERVICES, useValue: FIXTURE },
            ...(options.services === false ? [] : [{ provide: PLUGIN_SERVICES, useValue: services }]),
            ...(options.memory === false ? [] : [{ provide: LeadMemoryService, useValue: memory }]),
        ],
    }).compile()
    return { part: moduleRef.get(PluginToolsNativeService), services, tools, memory }
}

describe("PluginToolsNativeService: the tools come from the installation, the engine knows none", () => {
    it("lists the declared tools as manifest entries: the id without the public prefix, its validators and its masked members", async () => {
        const { part } = await build()

        expect(part.tools).toEqual([
            {
                name: "order.get",
                description: DECLARATION.description,
                scope: "read",
                defaultMode: "auto",
                inputSchema: DECLARATION.inputSchema,
                argumentSchema: DECLARATION.argumentSchema,
                secretFields: ["note"],
            },
        ])
        expect(part.serves("order.get")).toBe(true)
        expect(part.serves("order.delete")).toBe(false)
    })

    // Ledger (E-RED 2026-11-14, ruling R26): the conversation read is the ENGINE's own tool now (`channels/customer-message-native`, over
    // the core `customer_messages`), no longer a chatbot plugin read, so the installation serves only the five sales reads; the engine's
    // tool is proven by channels/customer-message-native.service.spec.ts.
    it("lists, from the app's installation, the five sales reads (no chatbot thread read: the engine owns it), read only, auto by default", () => {
        expect(pluginToolManifestsOf(INSTALLED).map((spec) => [spec.name, spec.scope, spec.defaultMode])).toEqual([
            ["lead.order.list", "read", "auto"],
            ["order.get", "read", "auto"],
            ["order.open.list", "read", "auto"],
            ["payment.claim.list", "read", "auto"],
            ["lead.care.get", "read", "auto"],
        ])
    })
})

describe("PluginToolsNativeService: a call goes to the service of the module that ships the tool", () => {
    it("resolves the module's service reaching every record of the workspace (the reach the reads always had) and hands it the facts of the run", async () => {
        const { part, services, tools } = await build()

        await expect(part.read(WS, "order.get", { orderId: "o1" }, SUBJECT, "customer", "agent-7")).resolves.toEqual({ order: { id: "o1" } })

        expect(services.forModule).toHaveBeenCalledWith(PLUGIN_TOOLS, { workspaceId: WS, moduleKey: "shop", sees: "all" })
        expect(tools.call).toHaveBeenCalledWith(
            TOOL.orderGet,
            { orderId: "o1" },
            expect.objectContaining({
                conversationId: "conv-1",
                agentId: "agent-7",
                contactId: "contact-1",
                leadId: "lead-1",
                audience: "customer",
                readNotice: CONTEXT_NOTICE,
            }),
        )
    })

    it("hands the lead memory as the care bridge reads it (`lead:<id>`, the step view), and none in an app with no lead memory", async () => {
        const { part, tools, memory } = await build()
        await part.read(WS, "order.get", { orderId: "o1" }, SUBJECT, "internal")
        const withMemory = tools.call.mock.calls[0]?.[2] as PluginToolCall

        await expect(withMemory.leadMemory?.()).resolves.toEqual({ careOptOut: true })
        expect(memory.snapshot).toHaveBeenCalledWith(WS, expect.objectContaining({ key: "lead:lead-1" }), "step")

        const bare = await build({ memory: false })
        await bare.part.read(WS, "order.get", { orderId: "o1" }, SUBJECT, "internal")
        expect((bare.tools.call.mock.calls[0]?.[2] as PluginToolCall).leadMemory).toBeNull()
    })

    it("answers the refusal the plugin gave as the refusal of the same name", async () => {
        const { part } = await build({ answer: { ok: false, reason: "other_contact" } })

        await expect(part.read(WS, "order.get", { orderId: "o1" }, SUBJECT, "customer")).rejects.toMatchObject({
            code: ToolsErrorCode.NativeRefused,
            params: { reason: "other_contact" },
        })
    })

    it("refuses arguments that do not fit the tool's validator before anything is resolved, and a tool it does not have", async () => {
        const { part, services } = await build()

        await expect(part.read(WS, "order.get", {}, SUBJECT, "internal")).rejects.toMatchObject({ code: ToolsErrorCode.InvalidArguments })
        await expect(part.read(WS, "order.delete", {}, SUBJECT, "internal")).rejects.toMatchObject({ code: ToolsErrorCode.UnknownTool })
        expect(services.forModule).not.toHaveBeenCalled()
    })

    it("answers not_found for a workspace that installed no agent of the module, and not_served in an app with no plugin services", async () => {
        const missing = await build({ missingAgent: true })
        await expect(missing.part.read(WS, "order.get", { orderId: "o1" }, SUBJECT, "internal")).rejects.toMatchObject({
            params: { reason: "not_found" },
        })

        const none = await build({ services: false })
        await expect(none.part.read(WS, "order.get", { orderId: "o1" }, SUBJECT, "internal")).rejects.toMatchObject({
            params: { reason: "not_served" },
        })
    })
})
