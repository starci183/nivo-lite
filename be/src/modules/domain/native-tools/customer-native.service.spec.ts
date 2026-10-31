import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentMessagesErrorCode, AgentMessagesService } from "@modules/domain/agent-messages"
import { LeadReadService } from "@modules/domain/leads"
import type { LeadView } from "@modules/domain/leads"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { CUSTOMER_MANIFEST, CustomerNativeService } from "./customer-native.service"

const WS = "11111111-1111-4111-8111-111111111111"
const CALLER = { agentId: "a1", conversationId: "conv-1" }
const WROTE = new Date("2026-10-30T08:15:00.000Z")

const LEAD: LeadView = {
    id: "lead-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "Zalo",
    need: "50 tea boxes",
    stage: "qualified",
    context_summary: null,
    installation_id: null,
    created_at: "2026-10-12T00:00:00.000Z",
}

const build = async () => {
    const conversations = mock<AgentConversationsReadService>({
        customerChat: jest.fn().mockResolvedValue({ id: "conv-1", leadId: "lead-1" }),
    })
    const leads = mock<LeadReadService>({
        listByIds: jest.fn().mockResolvedValue([LEAD]),
        contactOf: jest.fn().mockResolvedValue({ id: "lead-1", contact_name: "Lan", phone: "84901234567", email: null }),
    })
    const messages = mock<AgentMessagesService>({
        lastCustomerAt: jest.fn().mockResolvedValue({ kind: "ok", value: WROTE }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerNativeService,
            { provide: AgentConversationsReadService, useValue: conversations },
            { provide: LeadReadService, useValue: leads },
            { provide: AgentMessagesService, useValue: messages },
        ],
    }).compile()
    return { customer: moduleRef.get(CustomerNativeService), conversations, leads, messages }
}

describe("CustomerNativeService manifest", () => {
    it("declares one read tool that a customer conversation may call and whose answer is masked in the audit", () => {
        expect(CUSTOMER_MANIFEST.key).toBe("customer")
        expect(
            CUSTOMER_MANIFEST.tools.map((tool) => [tool.name, tool.scope, tool.internalOnly, tool.secretFields]),
        ).toEqual([["brief", "read", false, ["need", "company", "phoneMasked"]]])
    })
})

describe("CustomerNativeService brief", () => {
    it("answers the record of the customer of the caller's conversation, with the phone masked", async () => {
        const { customer, conversations, leads, messages } = await build()

        await expect(customer.invoke(WS, "brief", {}, CALLER)).resolves.toEqual({
            stage: "qualified",
            need: "50 tea boxes",
            company: "Hue Tea",
            source: "Zalo",
            lastCustomerAt: "2026-10-30T08:15:00.000Z",
            phoneMasked: "84…7",
        })
        expect(conversations.customerChat).toHaveBeenCalledWith(WS, "conv-1")
        expect(leads.listByIds).toHaveBeenCalledWith(WS, ["lead-1"])
        expect(messages.lastCustomerAt).toHaveBeenCalledWith("conv-1")
    })

    it("answers a null last message and an empty phone for a customer who never wrote or shared one", async () => {
        const { customer, leads, messages } = await build()
        messages.lastCustomerAt.mockResolvedValueOnce({ kind: "refused", code: AgentMessagesErrorCode.NotFound })
        leads.contactOf.mockResolvedValueOnce(null)

        await expect(customer.invoke(WS, "brief", {}, CALLER)).resolves.toMatchObject({
            lastCustomerAt: null,
            phoneMasked: "",
        })
    })

    it("clips a long need so a record cannot flood a turn", async () => {
        const { customer, leads } = await build()
        leads.listByIds.mockResolvedValueOnce([{ ...LEAD, need: "x".repeat(400) }])

        const answer = await customer.invoke(WS, "brief", {}, CALLER)

        expect(answer).toMatchObject({ need: `${"x".repeat(299)}…` })
    })

})

describe("CustomerNativeService refusals", () => {
    it("answers not found to a call that serves no conversation, before reading anything", async () => {
        const { customer, conversations } = await build()

        await expect(customer.invoke(WS, "brief", {}, { agentId: "a1", conversationId: null })).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_found" },
        })
        expect(conversations.customerChat).not.toHaveBeenCalled()
    })

    it("answers not found for a conversation of another workspace, one with no customer and a customer that is gone", async () => {
        const { customer, conversations, leads } = await build()
        conversations.customerChat.mockResolvedValueOnce(null)
        await expect(customer.invoke(WS, "brief", {}, CALLER)).rejects.toMatchObject({
            params: { reason: "not_found" },
        })
        conversations.customerChat.mockResolvedValueOnce({ id: "conv-1", leadId: null })
        await expect(customer.invoke(WS, "brief", {}, CALLER)).rejects.toMatchObject({
            params: { reason: "not_found" },
        })
        leads.listByIds.mockResolvedValueOnce([])
        await expect(customer.invoke(WS, "brief", {}, CALLER)).rejects.toMatchObject({
            params: { reason: "not_found" },
        })
    })

    it("takes no argument, so no call can name another customer's conversation", async () => {
        const { customer, conversations } = await build()

        await expect(customer.invoke(WS, "brief", { conversationId: "conv-2" }, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
            params: { tool: "brief" },
        })
        expect(conversations.customerChat).not.toHaveBeenCalled()
    })

    it("refuses a tool the connector does not have", async () => {
        const { customer } = await build()

        await expect(customer.invoke(WS, "delete", {}, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
            params: { tool: "delete" },
        })
    })
})
