import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { AGENTS_INSTALLATIONS } from "@modules/domain/agents"
import type { Installation, InstallationDirectory } from "@modules/domain/agents"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { GatewayCallResult, RoleResolution } from "@modules/domain/mcp-gateway"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { CapturedLead } from "./customer-turns.contracts"
import { GatewayContextService } from "./gateway-context.service"

const CONVERSATION: TurnConversation = {
    id: "c1",
    workspaceId: "ws",
    channel: "zalo",
    externalId: "z1:old",
    connectionId: "conn",
    leadId: "l1",
    handledBy: null,
    visitorName: "Lan Zalo",
    installationId: "i1",
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
const INSTALLATION: Installation = {
    id: "i1",
    workspaceId: "ws",
    module: "chatbot",
    name: "Sales",
    isMulti: true,
    agentId: "sales",
    operatingMode: "assist",
    settings: {},
    activeContextVersionId: null,
}
const BY_PHONE: Installation = { ...INSTALLATION, settings: { identity_match: "phone" } }
const LEAD: CapturedLead = { contactName: "Lan", company: "", need: "two nights", phone: "0900", email: null }
const CALLER = { workspaceId: "ws", agentId: "sales", conversationId: "c1", workItemId: null }
const FIND: RoleResolution = {
    ok: true,
    tool: { role: "identity.find", name: "crm.party.find", connector: "crm", connectorName: "CRM" },
}
const UPSERT: RoleResolution = {
    ok: true,
    tool: { role: "identity.upsert", name: "crm.party.upsert", connector: "crm", connectorName: "CRM" },
}
const FOUND: GatewayCallResult = { ok: true, value: { found: true, partyId: "p1", name: "Lan" } }
const NOT_FOUND: GatewayCallResult = { ok: true, value: { found: false } }
const DOWN: GatewayCallResult = { ok: false, code: "unavailable", detail: "timeout" }

const catalog = mock<MessageCatalog>({
    get: (key: string, params?: Readonly<Record<string, string | number>>) =>
        params === undefined || Object.keys(params).length === 0 ? key : `${key} ${JSON.stringify(params)}`,
})

const build = async () => {
    const installations = mock<InstallationDirectory>({ ofAgent: jest.fn().mockResolvedValue(INSTALLATION) })
    const gateway = mock<McpGatewayService>({
        grantsOf: jest.fn().mockResolvedValue([]),
        toolForRole: jest.fn((_ws: string, role: string) => Promise.resolve(role === "identity.find" ? FIND : UPSERT)),
        call: jest.fn().mockResolvedValue(FOUND),
    })
    const conversations = mock<AgentConversationsService>({
        isTestChat: jest.fn().mockResolvedValue(false),
        partyOf: jest.fn().mockResolvedValue(null),
        rememberParty: jest.fn().mockResolvedValue(undefined),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GatewayContextService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: McpGatewayService, useValue: gateway },
            { provide: AgentConversationsService, useValue: conversations },
        ],
    }).compile()
    return { service: moduleRef.get(GatewayContextService), gateway, conversations, installations }
}

describe("GatewayContextService grants and brief", () => {
    it("serves connectors when the agent holds a grant other than never", async () => {
        const { service, gateway } = await build()
        await expect(service.servesConnectors(CONVERSATION)).resolves.toBe(false)
        gateway.grantsOf.mockResolvedValueOnce([{ tool: "crm.*", mode: "never", constraints: [], limitVnd: null }])
        await expect(service.servesConnectors(CONVERSATION)).resolves.toBe(false)
        gateway.grantsOf.mockResolvedValueOnce([{ tool: "crm.*", mode: "ask", constraints: [], limitVnd: null }])
        await expect(service.servesConnectors(CONVERSATION)).resolves.toBe(true)
        expect(gateway.grantsOf).toHaveBeenCalledWith("ws", "sales")
    })

    it("writes the connector clause, with the party when a connector knows the customer", async () => {
        const { service } = await build()
        expect(service.briefOf(null)).toEqual(["gatewayTurns.contract"])
        expect(service.briefOf({ found: false, partyId: null, name: "" })).toEqual(["gatewayTurns.contract"])
        expect(service.briefOf({ found: true, partyId: "p1", name: "Lan" })).toEqual([
            "gatewayTurns.contract",
            'gatewayTurns.partyKnown {"name":"Lan"}',
        ])
        expect(service.briefOf({ found: true, partyId: "p1", name: "" })[1]).toContain('"name":"-"')
    })
})

describe("GatewayContextService party", () => {
    it("answers the party the conversation remembers without asking a connector", async () => {
        const { service, gateway, conversations } = await build()
        conversations.partyOf.mockResolvedValueOnce({ partyId: "p1", name: "Lan" })
        await expect(service.partyOf(CONVERSATION)).resolves.toEqual({ found: true, partyId: "p1", name: "Lan" })
        expect(conversations.partyOf).toHaveBeenCalledWith("ws", "c1")
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("finds the party by the channel identity and remembers it on the conversation", async () => {
        const { service, gateway, conversations } = await build()
        await expect(service.partyOf(CONVERSATION)).resolves.toEqual({ found: true, partyId: "p1", name: "Lan" })
        expect(gateway.toolForRole).toHaveBeenCalledWith("ws", "identity.find")
        expect(gateway.call).toHaveBeenCalledWith(CALLER, "crm.party.find", { channel: "zalo", externalId: "z1" })
        expect(conversations.rememberParty).toHaveBeenCalledWith({
            workspaceId: "ws",
            conversationId: "c1",
            party: { partyId: "p1", name: "Lan" },
        })
    })

    it.each([
        ["z1", "z1"],
        ["z1:old:older", "z1"],
        ["z1\nline:old\nmore", "z1\nline"],
        [`z${"1".repeat(50_000)}:${":".repeat(50_000)}`, `z${"1".repeat(50_000)}`],
    ])("asks by the channel user %#, cut at its first colon", async (externalId, channelUser) => {
        const { service, gateway } = await build()
        await service.partyOf({ ...CONVERSATION, externalId })
        expect(gateway.call).toHaveBeenCalledWith(CALLER, "crm.party.find", {
            channel: "zalo",
            externalId: channelUser,
        })
    })

    it("remembers nothing when the connector does not know the customer or answers no party id", async () => {
        const { service, gateway, conversations } = await build()
        gateway.call
            .mockResolvedValueOnce(NOT_FOUND)
            .mockResolvedValueOnce({ ok: true, value: { found: true, name: 7 } })
        await expect(service.partyOf(CONVERSATION)).resolves.toEqual({ found: false, partyId: null, name: "" })
        await expect(service.partyOf(CONVERSATION)).resolves.toEqual({ found: false, partyId: null, name: "" })
        expect(conversations.rememberParty).not.toHaveBeenCalled()
    })

    it("answers null without a channel identity, when the workspace matches by phone, without the role or on failure", async () => {
        const { service, gateway, installations } = await build()
        await expect(service.partyOf({ ...CONVERSATION, externalId: null })).resolves.toBeNull()
        installations.ofAgent.mockResolvedValueOnce(BY_PHONE)
        await expect(service.partyOf(CONVERSATION)).resolves.toBeNull()
        gateway.toolForRole.mockResolvedValueOnce({ ok: false, code: "no_capability", role: "identity.find" })
        await expect(service.partyOf(CONVERSATION)).resolves.toBeNull()
        installations.ofAgent.mockResolvedValueOnce(null)
        gateway.call.mockResolvedValueOnce(DOWN)
        await expect(service.partyOf(CONVERSATION)).resolves.toBeNull()
        expect(gateway.call).toHaveBeenCalledTimes(1)
    })
})

describe("GatewayContextService remember by channel", () => {
    it("creates an unknown customer through identity.upsert under the message's step key and remembers the party", async () => {
        const { service, gateway, conversations } = await build()
        gateway.call.mockResolvedValueOnce(NOT_FOUND).mockResolvedValueOnce({ ok: true, value: { partyId: "p9" } })
        await service.remember(CONVERSATION, LEAD, "m1")
        expect(gateway.toolForRole).toHaveBeenLastCalledWith("ws", "identity.upsert")
        expect(gateway.call).toHaveBeenLastCalledWith({ ...CALLER, opKey: "m1:identity.upsert" }, "crm.party.upsert", {
            channel: "zalo",
            externalId: "z1",
            name: "Lan",
            phone: "0900",
        })
        expect(conversations.rememberParty).toHaveBeenCalledWith({
            workspaceId: "ws",
            conversationId: "c1",
            party: { partyId: "p9", name: "Lan" },
        })
    })

    it("sends no phone the customer did not give, and remembers nothing when the connector refuses", async () => {
        const { service, gateway, conversations } = await build()
        gateway.call.mockResolvedValueOnce(NOT_FOUND).mockResolvedValueOnce(DOWN)
        await service.remember(CONVERSATION, { ...LEAD, phone: null }, "m1")
        expect(gateway.call.mock.calls[1]?.[2]).toEqual({ channel: "zalo", externalId: "z1", name: "Lan" })
        expect(conversations.rememberParty).not.toHaveBeenCalled()
    })

    it("creates nobody when the connector already knows the customer or answers no party id", async () => {
        const { service, gateway, conversations } = await build()
        await service.remember(CONVERSATION, LEAD, "m1")
        expect(gateway.toolForRole).not.toHaveBeenCalledWith("ws", "identity.upsert")
        gateway.call.mockResolvedValueOnce(NOT_FOUND).mockResolvedValueOnce({ ok: true, value: {} })
        await service.remember(CONVERSATION, LEAD, "m2")
        expect(conversations.rememberParty).toHaveBeenCalledTimes(1)
    })

    it("creates nobody for a remembered party, a test chat, without a channel identity or without the role", async () => {
        const { service, gateway, conversations } = await build()
        conversations.partyOf.mockResolvedValueOnce({ partyId: "p1", name: "Lan" })
        await service.remember(CONVERSATION, LEAD, "m1")
        conversations.isTestChat.mockResolvedValueOnce(true)
        await service.remember(CONVERSATION, LEAD, "m1")
        await service.remember({ ...CONVERSATION, externalId: null }, LEAD, "m1")
        expect(gateway.call).not.toHaveBeenCalled()
        gateway.call.mockResolvedValueOnce(NOT_FOUND)
        gateway.toolForRole
            .mockResolvedValueOnce(FIND)
            .mockResolvedValueOnce({ ok: false, code: "no_capability", role: "identity.upsert" })
        await service.remember(CONVERSATION, LEAD, "m2")
        expect(gateway.call).toHaveBeenCalledTimes(1)
    })
})

describe("GatewayContextService remember by phone", () => {
    it("finds the customer by the phone they gave across channels and remembers the party", async () => {
        const { service, gateway, conversations, installations } = await build()
        installations.ofAgent.mockResolvedValue(BY_PHONE)
        await service.remember(CONVERSATION, LEAD, "m1")
        expect(gateway.call).toHaveBeenCalledWith(CALLER, "crm.party.find", { channel: "phone", externalId: "0900" })
        expect(conversations.rememberParty).toHaveBeenCalledWith({
            workspaceId: "ws",
            conversationId: "c1",
            party: { partyId: "p1", name: "Lan" },
        })
    })

    it("creates the customer under their phone when no connector knows it, and waits while no phone is given", async () => {
        const { service, gateway, installations } = await build()
        installations.ofAgent.mockResolvedValue(BY_PHONE)
        await service.remember(CONVERSATION, { ...LEAD, phone: null }, "m1")
        expect(gateway.call).not.toHaveBeenCalled()
        gateway.call.mockResolvedValueOnce(NOT_FOUND).mockResolvedValueOnce({ ok: true, value: { partyId: "p9" } })
        await service.remember(CONVERSATION, LEAD, "m2")
        expect(gateway.call).toHaveBeenLastCalledWith({ ...CALLER, opKey: "m2:identity.upsert" }, "crm.party.upsert", {
            channel: "phone",
            externalId: "0900",
            name: "Lan",
            phone: "0900",
        })
    })
})
