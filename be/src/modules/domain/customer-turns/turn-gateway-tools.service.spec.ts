import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsService, AgentConversationsErrorCode } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { ToolContext } from "@modules/domain/agent-tools"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { HubNotesService } from "./hub-notes.service"
import { TurnGatewayToolsService } from "./turn-gateway-tools.service"
import { TurnSourcesService } from "./turn-sources.service"

const CTX: ToolContext = { jobId: "m1", workspaceId: "ws", conversationId: "c1" }
const CONVERSATION: TurnConversation = {
    id: "c1",
    workspaceId: "ws",
    channel: "zalo",
    externalId: "z1",
    connectionId: "conn",
    leadId: "l1",
    handledBy: null,
    visitorName: "Lan",
    installationId: null,
    agent: {
        id: "sales",
        name: "AI Sales",
        handle: "ai-sales",
        role: "",
        module: "chatbot",
        instructions: "",
        knowledge: "",
        approvalRule: "",
        greeting: "",
    },
}
const CALLER = { workspaceId: "ws", agentId: "sales", conversationId: "c1", workItemId: null }
const DESCRIBED = {
    name: "crm.order.place",
    description: "Place an order",
    scope: "write" as const,
    mode: "auto" as const,
    inputSchema: { type: "object" },
    constraints: [],
    limitVnd: null,
}
const READ = { ...DESCRIBED, name: "crm.stock.read", description: "Read stock", scope: "read" as const }
const PRICE_LIST = [{ layer: 2 as const, kind: "brain_document", ref: "src-1", label: "Price list" }]
const ORDER_SOURCE = { layer: 1, kind: "mcp_tool", ref: "crm.order.place", label: "crm.order.place" }

const catalog = mock<MessageCatalog>({
    get: (key: string, params?: Readonly<Record<string, string | number>>) => `${key} ${JSON.stringify(params ?? {})}`,
})

const build = async () => {
    const gateway = mock<McpGatewayService>({
        search: jest
            .fn()
            .mockResolvedValue([{ name: "crm.order.place", description: "", scope: "write", mode: "auto" }]),
        describe: jest.fn().mockResolvedValue(DESCRIBED),
        call: jest.fn().mockResolvedValue({ ok: true, value: { orderId: "o1" } }),
    })
    const conversations = mock<AgentConversationsService>({
        turnOf: jest.fn().mockResolvedValue({ kind: "ok", value: CONVERSATION }),
        isTestChat: jest.fn().mockResolvedValue(false),
    })
    const item = mock<WorkItem>()
    Object.assign(item, { id: "w1" })
    const engine = mock<WorkEngineService>({ runWork: jest.fn().mockResolvedValue(item) })
    const notes = mock<HubNotesService>({ post: jest.fn().mockResolvedValue(undefined) })
    const sources = mock<TurnSourcesService>({ of: jest.fn().mockReturnValue(PRICE_LIST) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            TurnGatewayToolsService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: McpGatewayService, useValue: gateway },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: WorkEngineService, useValue: engine },
            { provide: HubNotesService, useValue: notes },
            { provide: TurnSourcesService, useValue: sources },
        ],
    }).compile()
    return { service: moduleRef.get(TurnGatewayToolsService), gateway, conversations, engine, notes, sources }
}

describe("TurnGatewayToolsService discovery", () => {
    it("searches the tools the conversation's agent may use, with a bounded limit", async () => {
        const { service, gateway } = await build()
        await expect(service.run(CTX, "tool.search", { query: " order ", limit: 3 })).resolves.toEqual({
            tools: [{ name: "crm.order.place", description: "", scope: "write", mode: "auto" }],
        })
        expect(gateway.search).toHaveBeenCalledWith(CALLER, "order", 3)
        await service.run(CTX, "tool.search", { query: "x", limit: 50 })
        await service.run(CTX, "tool.search", { query: 4, limit: 0.5 })
        expect(gateway.search.mock.calls.slice(1).map((call) => [call[1], call[2]])).toEqual([
            ["x", 10],
            ["", 5],
        ])
    })

    it("describes one granted tool, or says it is unknown or not granted", async () => {
        const { service, gateway } = await build()
        await expect(service.run(CTX, "tool.describe", { name: "crm.order.place" })).resolves.toEqual(DESCRIBED)
        gateway.describe.mockResolvedValueOnce(null)
        await expect(service.run(CTX, "tool.describe", { name: "crm.secret" })).resolves.toEqual({
            error: "not_granted_or_unknown",
        })
    })

    it("answers not found for a missing conversation or one of another workspace, and calls nothing", async () => {
        const { service, gateway, conversations } = await build()
        conversations.turnOf.mockResolvedValueOnce({ kind: "refused", code: AgentConversationsErrorCode.NotFound })
        await expect(service.run(CTX, "tool.search", { query: "x" })).resolves.toEqual({
            error: "conversation_not_found",
        })
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: { ...CONVERSATION, workspaceId: "other" } })
        await expect(service.run(CTX, "tool.call", { name: "crm.order.place" })).resolves.toEqual({
            error: "conversation_not_found",
        })
        expect(conversations.turnOf).toHaveBeenCalledWith("c1")
        expect(gateway.search).not.toHaveBeenCalled()
        expect(gateway.call).not.toHaveBeenCalled()
    })
})

describe("TurnGatewayToolsService calls", () => {
    it("calls the tool as the agent under a step key of the inbound message and posts the done card of a write", async () => {
        const { service, gateway, notes, sources } = await build()
        await expect(
            service.run(CTX, "tool.call", { name: "crm.order.place", arguments_json: '{"sku":"a","qty":2}' }),
        ).resolves.toEqual({ result: { orderId: "o1" } })
        await service.run(CTX, "tool.call", { name: "crm.order.place", arguments_json: '{"sku":"b"}' })
        await service.run(CTX, "tool.call", { name: "crm.order.place", arguments_json: '{"sku":"a","qty":2}' })
        const keys = gateway.call.mock.calls.map((call) => call[0].opKey)
        expect(keys[0]).toMatch(/^m1:crm\.order\.place:[0-9a-f]{16}$/u)
        expect(keys[1]).not.toBe(keys[0])
        expect(keys[2]).toBe(keys[0])
        expect(gateway.call.mock.calls[0]?.[0]).toMatchObject(CALLER)
        expect(gateway.call.mock.calls[0]?.[2]).toEqual({ sku: "a", qty: 2 })
        expect(sources.of).toHaveBeenCalledWith("m1")
        expect(notes.post.mock.calls[0]).toEqual([
            {
                workspaceId: "ws",
                room: "",
                type: "action_done",
                title: 'gatewayTurns.cardActionDone {"what":"Place an order"}',
                fields: [
                    { label: "gatewayTurns.field.tool {}", value: "crm.order.place" },
                    { label: "gatewayTurns.field.customer {}", value: "Lan" },
                ],
                authorName: "AI Sales",
                sources: [ORDER_SOURCE, ...PRICE_LIST],
            },
            "sales",
            { leadId: "l1", workItemId: null },
        ])
    })

    it("names a write by its tool when it has no description, and an unnamed customer as empty", async () => {
        const { service, gateway, notes, conversations } = await build()
        gateway.describe.mockResolvedValueOnce({ ...DESCRIBED, description: "" })
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: { ...CONVERSATION, visitorName: null } })
        await service.run(CTX, "tool.call", { name: "crm.order.place" })
        expect(gateway.call.mock.calls[0]?.[2]).toEqual({})
        expect(notes.post.mock.calls[0]?.[0].title).toContain('"what":"crm.order.place"')
        expect(notes.post.mock.calls[0]?.[0].fields[1]?.value).toBe("")
    })

    it("posts no card for a read, nor for a tool the agent may not describe", async () => {
        const { service, gateway, notes } = await build()
        gateway.describe.mockResolvedValueOnce(READ).mockResolvedValueOnce(null)
        await service.run(CTX, "tool.call", { name: "crm.stock.read" })
        await service.run(CTX, "tool.call", { name: "crm.hidden" })
        expect(gateway.call).toHaveBeenCalledTimes(2)
        expect(notes.post).not.toHaveBeenCalled()
    })

    it("refuses arguments that are no JSON object before calling anything", async () => {
        const { service, gateway } = await build()
        for (const text of ["nope", "[1]"]) {
            await expect(
                service.run(CTX, "tool.call", { name: "crm.order.place", arguments_json: text }),
            ).resolves.toEqual({
                error: "invalid_arguments",
                detail: "arguments_json is not a JSON object",
            })
        }
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("answers a failed call as it is and opens no approval", async () => {
        const { service, gateway, engine, notes } = await build()
        gateway.call.mockResolvedValueOnce({ ok: false, code: "tool_error", detail: "out of stock" })
        await expect(service.run(CTX, "tool.call", { name: "crm.order.place" })).resolves.toEqual({
            error: "tool_error",
            detail: "out of stock",
        })
        expect(engine.runWork).not.toHaveBeenCalled()
        expect(notes.post).not.toHaveBeenCalled()
    })
})

describe("TurnGatewayToolsService approvals", () => {
    it("opens the gateway_call approval with the exact call and the turn's sources when a person must decide", async () => {
        const { service, gateway, engine } = await build()
        gateway.call.mockResolvedValueOnce({ ok: false, code: "approval_required", reason: "over_limit_vnd" })
        await expect(
            service.run(CTX, "tool.call", { name: "crm.order.place", arguments_json: '{"sku":"a"}' }),
        ).resolves.toEqual({ status: "approval_requested", reason: "over_limit_vnd", work_item_id: "w1" })
        const [ctx, spec] = engine.runWork.mock.calls[0] ?? []
        expect(ctx).toEqual({ workspaceId: "ws", actor: "OpenClaw", locale: "vi" })
        expect(spec).toMatchObject({
            action: "gateway_call",
            subject_type: "conversation",
            subject_id: "c1",
            lead_id: "l1",
            forceAsk: "over_authority",
            seed: {
                summary:
                    'gatewayTurns.approvalSummary {"tool":"crm.order.place","name":"Lan","reason":"over_limit_vnd"}',
                draft: "gatewayTurns.approvedDone {}",
                fields: {
                    tool: "crm.order.place",
                    args_json: '{"sku":"a"}',
                    customer: "Lan",
                    conversation_id: "c1",
                    agent_id: "sales",
                    reason: "over_limit_vnd",
                    sources: JSON.stringify([ORDER_SOURCE, ...PRICE_LIST]),
                },
            },
        })
        expect(spec?.dedupeKey).toBe(`gateway_call:${String(gateway.call.mock.calls[0]?.[0].opKey)}`)
    })

    it("names an unnamed customer with a dash on the approval", async () => {
        const { service, gateway, engine, conversations } = await build()
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: { ...CONVERSATION, visitorName: null } })
        gateway.call.mockResolvedValueOnce({ ok: false, code: "approval_required", reason: "ask_mode" })
        await service.run(CTX, "tool.call", { name: "crm.order.place" })
        expect(engine.runWork.mock.calls[0]?.[1].seed?.summary).toContain('"name":"-"')
        expect(engine.runWork.mock.calls[0]?.[1].seed?.fields?.customer).toBe("")
    })
})

describe("TurnGatewayToolsService sequence", () => {
    const STEPS = JSON.stringify([
        { name: "crm.stock.read", arguments: { sku: "a" } },
        { name: "crm.order.place", arguments: { sku: "a" } },
    ])

    it("holds a playbook's steps for one approval with the reply, the steps and the turn's sources, and calls nothing", async () => {
        const { service, gateway, engine } = await build()
        gateway.describe.mockResolvedValueOnce(READ).mockResolvedValueOnce(DESCRIBED)
        await expect(
            service.run(CTX, "tool.sequence", { steps_json: STEPS, reply: " Done for you " }),
        ).resolves.toEqual({
            status: "approval_requested",
            reason: "playbook",
            work_item_id: "w1",
        })
        expect(gateway.call).not.toHaveBeenCalled()
        const spec = engine.runWork.mock.calls[0]?.[1]
        expect(spec?.dedupeKey).toMatch(/^gateway_call:m1:sequence:[0-9a-f]{16}$/u)
        expect(spec?.seed).toMatchObject({
            summary:
                'gatewayTurns.approvalSummary {"tool":"crm.stock.read > crm.order.place","name":"Lan","reason":"playbook"}',
            draft: "Done for you",
            fields: {
                steps_json: STEPS,
                reason: "playbook",
                sources: JSON.stringify([
                    { layer: 1, kind: "mcp_tool", ref: "crm.stock.read", label: "crm.stock.read" },
                    ORDER_SOURCE,
                    ...PRICE_LIST,
                ]),
            },
        })
    })

    it("tells the customer the approved line when the agent gave no reply", async () => {
        const { service, engine } = await build()
        await service.run(CTX, "tool.sequence", { steps_json: STEPS })
        expect(engine.runWork.mock.calls[0]?.[1].seed?.draft).toBe("gatewayTurns.approvedDone {}")
    })

    it("refuses steps that are no valid list, or name a tool the agent may not use", async () => {
        const { service, gateway, engine } = await build()
        await expect(service.run(CTX, "tool.sequence", { steps_json: "[]" })).resolves.toEqual({
            error: "invalid_steps",
            detail: "steps_json is a list of 1 to 10 calls",
        })
        gateway.describe.mockResolvedValueOnce(READ).mockResolvedValueOnce(null)
        await expect(service.run(CTX, "tool.sequence", { steps_json: STEPS })).resolves.toEqual({
            error: "not_granted_or_unknown",
            detail: "crm.order.place",
        })
        expect(engine.runWork).not.toHaveBeenCalled()
    })
})

describe("TurnGatewayToolsService test chat", () => {
    it("runs a granted read-scope call of a test chat for real", async () => {
        const { service, gateway, conversations } = await build()
        conversations.isTestChat.mockResolvedValue(true)
        gateway.describe.mockResolvedValueOnce(READ)
        await expect(service.run(CTX, "tool.call", { name: "crm.stock.read" })).resolves.toEqual({
            result: { orderId: "o1" },
        })
        expect(gateway.describe).toHaveBeenCalledWith(CALLER, "crm.stock.read")
    })

    it("refuses a write, an unknown call or a writing sequence of a test chat with a simulation answer", async () => {
        const { service, gateway, engine, conversations, notes } = await build()
        conversations.isTestChat.mockResolvedValue(true)
        const simulation = { error: "simulation", detail: "a test chat runs connector tools read-only" }
        await expect(service.run(CTX, "tool.call", { name: "crm.order.place" })).resolves.toEqual(simulation)
        gateway.describe.mockResolvedValueOnce(null)
        await expect(service.run(CTX, "tool.call", { name: "crm.unknown" })).resolves.toEqual(simulation)
        await expect(
            service.run(CTX, "tool.sequence", { steps_json: JSON.stringify([{ name: "crm.order.place" }]) }),
        ).resolves.toEqual(simulation)
        expect(conversations.isTestChat).toHaveBeenCalledWith("c1")
        expect(gateway.call).not.toHaveBeenCalled()
        expect(engine.runWork).not.toHaveBeenCalled()
        expect(notes.post).not.toHaveBeenCalled()
    })

    it("holds a read-only sequence of a test chat like any other, since nothing runs before approval", async () => {
        const { service, gateway, conversations, engine } = await build()
        conversations.isTestChat.mockResolvedValue(true)
        gateway.describe.mockResolvedValue(READ)
        await expect(
            service.run(CTX, "tool.sequence", { steps_json: JSON.stringify([{ name: "crm.stock.read" }]) }),
        ).resolves.toMatchObject({ status: "approval_requested" })
        expect(engine.runWork).toHaveBeenCalledTimes(1)
    })
})
