import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { GatewayCallPerformerService } from "./gateway-call-performer.service"

const CTX: WorkContext = { workspaceId: "ws", actor: "Manager", locale: "vi" }
const PROPOSAL: Proposal = {
    summary: "booking.confirm for Lan",
    draft: "The manager approved 20% off",
    fields: {
        tool: "hakuen.booking.confirm",
        args_json: '{"holdId":"bh1","discountPct":20}',
        conversation_id: "c1",
        agent_id: "sales",
    },
}

const itemOf = (proposal: Proposal): WorkItem => {
    const item = mock<WorkItem>()
    Object.assign(item, { id: "w1", lead_id: "l1", proposal })
    return item
}

const build = async () => {
    const gateway = mock<McpGatewayService>({
        call: jest.fn().mockResolvedValue({ ok: true, value: { bookingId: "B-1" } }),
    })
    const delivery = mock<CustomerDeliveryService>({ approvedInConversation: jest.fn().mockResolvedValue(true) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GatewayCallPerformerService,
            { provide: McpGatewayService, useValue: gateway },
            { provide: CustomerDeliveryService, useValue: delivery },
        ],
    }).compile()
    return { performer: moduleRef.get(GatewayCallPerformerService), gateway, delivery }
}

describe("GatewayCallPerformerService", () => {
    it("keeps the preset proposal", async () => {
        const { performer } = await build()
        await expect(performer.prepare(CTX, itemOf(PROPOSAL))).resolves.toEqual({ proposal: PROPOSAL })
    })

    it("replays the exact call as approved and answers the guest", async () => {
        const { performer, gateway, delivery } = await build()
        await expect(
            performer.perform(CTX, itemOf(PROPOSAL), PROPOSAL, { name: "Manager", kind: "owner" }),
        ).resolves.toEqual({
            summary: "booking.confirm for Lan",
            evidence: "captured",
            lead_id: "l1",
            detail: "The manager approved 20% off",
        })
        expect(gateway.call).toHaveBeenCalledWith(
            {
                workspaceId: "ws",
                agentId: "sales",
                conversationId: "c1",
                workItemId: "w1",
                approvedBy: "Manager",
                opKey: "w1:hakuen.booking.confirm",
            },
            "hakuen.booking.confirm",
            { holdId: "bh1", discountPct: 20 },
        )
        expect(delivery.approvedInConversation).toHaveBeenCalledWith(
            "ws",
            "c1",
            "The manager approved 20% off",
            "Manager",
            "w1",
        )
    })

    it("sends nothing when there is no reply to send", async () => {
        const { performer, delivery } = await build()
        const quiet = { ...PROPOSAL, draft: undefined, fields: { ...PROPOSAL.fields, agent_id: 7 } }
        await expect(performer.perform(CTX, itemOf(quiet), quiet, { name: "An" })).resolves.toMatchObject({
            detail: null,
        })
        expect(delivery.approvedInConversation).not.toHaveBeenCalled()
    })

    it.each([
        ["no tool", { ...PROPOSAL.fields, tool: null }],
        ["arguments that are no object", { ...PROPOSAL.fields, args_json: "[]" }],
        ["arguments that are no JSON", { ...PROPOSAL.fields, args_json: "nope" }],
        ["arguments that are no text", { ...PROPOSAL.fields, args_json: 3 }],
        ["no conversation", { ...PROPOSAL.fields, conversation_id: "" }],
    ])("fails an item with %s and calls nothing", async (_case, fields) => {
        const { performer, gateway } = await build()
        const broken = { ...PROPOSAL, fields }
        const failure = performer.perform(CTX, itemOf(broken), broken, { name: "An" })
        await expect(failure).rejects.toBeInstanceOf(WorkPerformersError)
        await expect(failure).rejects.toMatchObject({ code: WorkPerformersErrorCode.ApprovalInvalid })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("fails the item when the connector refuses the replayed call, and tells the guest nothing", async () => {
        const { performer, gateway, delivery } = await build()
        gateway.call.mockResolvedValue({ ok: false, code: "tool_error", detail: "expired" })
        await expect(performer.perform(CTX, itemOf(PROPOSAL), PROPOSAL, { name: "An" })).rejects.toMatchObject({
            code: WorkPerformersErrorCode.ConnectorRefused,
        })
        expect(delivery.approvedInConversation).not.toHaveBeenCalled()
    })
})

describe("GatewayCallPerformerService sequence", () => {
    const STEPS = [
        { name: "crm.stay.checkIn", arguments: { stayId: "s1" } },
        { name: "crm.key.send", arguments: { stayId: "s1" } },
    ]
    const SEQUENCE: Proposal = {
        summary: "crm.stay.checkIn > crm.key.send for Lan",
        draft: "Your room is ready",
        fields: { steps_json: JSON.stringify(STEPS), conversation_id: "c1", agent_id: "care" },
    }

    it("runs the approved steps in order, each under its own replay key, then answers the customer", async () => {
        const { performer, gateway, delivery } = await build()
        await expect(performer.perform(CTX, itemOf(SEQUENCE), SEQUENCE, { name: "Front desk" })).resolves.toEqual({
            summary: "crm.stay.checkIn > crm.key.send for Lan",
            evidence: "captured",
            lead_id: "l1",
            detail: "Your room is ready",
        })
        expect(gateway.call.mock.calls.map((call) => [call[0].opKey, call[1], call[2]])).toEqual([
            ["w1:0:crm.stay.checkIn", "crm.stay.checkIn", { stayId: "s1" }],
            ["w1:1:crm.key.send", "crm.key.send", { stayId: "s1" }],
        ])
        expect(gateway.call.mock.calls[0]?.[0]).toMatchObject({
            agentId: "care",
            approvedBy: "Front desk",
            workItemId: "w1",
        })
        expect(delivery.approvedInConversation).toHaveBeenCalledWith(
            "ws",
            "c1",
            "Your room is ready",
            "Front desk",
            "w1",
        )
    })

    it("stops at the first step the connector refuses and tells the customer nothing", async () => {
        const { performer, gateway, delivery } = await build()
        gateway.call.mockResolvedValueOnce({ ok: false, code: "tool_error", detail: "not allowed" })
        await expect(performer.perform(CTX, itemOf(SEQUENCE), SEQUENCE, { name: "Front desk" })).rejects.toMatchObject({
            code: WorkPerformersErrorCode.ConnectorRefused,
            params: { tool: "crm.stay.checkIn", code: "tool_error" },
        })
        expect(gateway.call).toHaveBeenCalledTimes(1)
        expect(delivery.approvedInConversation).not.toHaveBeenCalled()
    })

    it("fails a sequence that is no valid list of steps and calls nothing", async () => {
        const { performer, gateway } = await build()
        const broken = { ...SEQUENCE, fields: { ...SEQUENCE.fields, steps_json: "[]" } }
        await expect(performer.perform(CTX, itemOf(broken), broken, { name: "Front desk" })).rejects.toMatchObject({
            code: WorkPerformersErrorCode.ApprovalInvalid,
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })
})
