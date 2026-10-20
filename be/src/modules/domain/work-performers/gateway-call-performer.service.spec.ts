import { mock } from "@starci/jest-preset"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { WorkPerformersError } from "./errors/work-performers.error"
import { argsOfField, GatewayCallPerformerService } from "./gateway-call-performer.service"

const CTX: WorkContext = { workspaceId: "ws", actor: "Quản lý", locale: "vi" }
const PROPOSAL: Proposal = {
    summary: "booking.confirm for Lan",
    draft: "Đã duyệt giảm 20%",
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

const build = () => {
    const gateway = mock<McpGatewayService>()
    gateway.call.mockResolvedValue({ ok: true, value: { bookingId: "B-1" } })
    const delivery = mock<CustomerDeliveryService>()
    delivery.approvedInConversation.mockResolvedValue(true)
    return { performer: new GatewayCallPerformerService(gateway, delivery), gateway, delivery }
}

describe("GatewayCallPerformerService", () => {
    it("keeps the preset proposal", async () => {
        const item = itemOf(PROPOSAL)
        await expect(build().performer.prepare(CTX, item)).resolves.toEqual({ proposal: PROPOSAL })
    })

    it("replays the exact call as approved and answers the guest", async () => {
        const { performer, gateway, delivery } = build()
        await expect(
            performer.perform(CTX, itemOf(PROPOSAL), PROPOSAL, { name: "Quản lý", kind: "owner" }),
        ).resolves.toEqual({
            summary: "booking.confirm for Lan",
            evidence: "captured",
            lead_id: "l1",
            detail: "Đã duyệt giảm 20%",
        })
        expect(gateway.call).toHaveBeenCalledWith(
            { workspaceId: "ws", agentId: "sales", conversationId: "c1", workItemId: "w1", approvedBy: "Quản lý" },
            "hakuen.booking.confirm",
            { holdId: "bh1", discountPct: 20 },
        )
        expect(delivery.approvedInConversation).toHaveBeenCalledWith("ws", "c1", "Đã duyệt giảm 20%", "Quản lý", "w1")
    })

    it("sends nothing when there is no reply to send", async () => {
        const { performer, delivery } = build()
        const quiet = { ...PROPOSAL, draft: undefined }
        await expect(performer.perform(CTX, itemOf(quiet), quiet, { name: "An" })).resolves.toMatchObject({
            detail: null,
        })
        expect(delivery.approvedInConversation).not.toHaveBeenCalled()
    })

    it("fails an item without a call, and a call HAKUEN refused", async () => {
        const { performer, gateway } = build()
        for (const fields of [
            { ...PROPOSAL.fields, tool: null },
            { ...PROPOSAL.fields, args_json: "[]" },
            { ...PROPOSAL.fields, conversation_id: "" },
        ]) {
            const broken = { ...PROPOSAL, fields }
            await expect(performer.perform(CTX, itemOf(broken), broken, { name: "An" })).rejects.toBeInstanceOf(
                WorkPerformersError,
            )
        }
        gateway.call.mockResolvedValue({ ok: false, code: "tool_error", detail: "expired" })
        await expect(performer.perform(CTX, itemOf(PROPOSAL), PROPOSAL, { name: "An" })).rejects.toBeInstanceOf(
            WorkPerformersError,
        )
    })

    it("reads stored arguments", () => {
        expect(argsOfField('{"a":1}')).toEqual({ a: 1 })
        expect(argsOfField("nope")).toBeNull()
        expect(argsOfField(3)).toBeNull()
    })
})
