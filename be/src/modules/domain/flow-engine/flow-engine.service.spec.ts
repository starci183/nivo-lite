import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ChatReplyService } from "@modules/domain/chatreply"
import { DecisionsService, WorkDecisionService, WorkPlacementService } from "@modules/domain/decisions"
import { StaffService } from "@modules/domain/staff"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { AuthorityChatService } from "./authority-chat.service"
import { FlowEngineErrorCode } from "./errors/flow-engine.error"
import type { SimulatedInputs } from "./flow-engine.contracts"
import { FLOW_SIMULATED_INPUTS } from "./flow-engine.decorators"
import { FlowEngineService } from "./flow-engine.service"
import { OwnerChatService } from "./owner-chat.service"

const member = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
})()

const build = async () => {
    const decide = jest.fn().mockResolvedValue({ id: "item-1", status: "done" })
    const hold = jest.fn().mockResolvedValue({ id: "item-1", status: "waiting_decision" })
    const saveRule = jest.fn().mockResolvedValue({ action: "send_quote", mode: "ask" })
    const setHandling = jest.fn().mockResolvedValue({ conversationId: "conv-1", handledBy: "An" })
    const request = jest.fn().mockResolvedValue({ id: "event-1", status: "queued", duplicate: false })
    const reply = jest.fn().mockResolvedValue({ handled: true, reply: "ok", posted: false })
    const simulator = mock<SimulatedInputs>({ request })
    const moduleRef = await Test.createTestingModule({
        providers: [
            FlowEngineService,
            { provide: DecisionsService, useValue: mock<DecisionsService>({ saveRule }) },
            { provide: WorkDecisionService, useValue: mock<WorkDecisionService>({ decide }) },
            { provide: WorkPlacementService, useValue: mock<WorkPlacementService>({ hold }) },
            { provide: StaffService, useValue: mock<StaffService>({}) },
            { provide: FLOW_SIMULATED_INPUTS, useValue: simulator },
            { provide: ChatReplyService, useValue: mock<ChatReplyService>({ setHandling }) },
            { provide: AuthorityChatService, useValue: mock<AuthorityChatService>({}) },
            { provide: OwnerChatService, useValue: mock<OwnerChatService>({ reply }) },
        ],
    }).compile()
    return { service: moduleRef.get(FlowEngineService), decide, hold, saveRule, setHandling, request, reply }
}

describe("FlowEngineService", () => {
    it("decides a work item as the member and answers the item", async () => {
        const { service, decide } = await build()

        const result = await service.run({
            kind: "decide",
            workspaceId: "ws-1",
            member,
            payload: { workItemId: "item-1", decision: "approved", edits: { fields: { amount_vnd: 5 } }, locale: "en" },
        })

        expect(result.data).toEqual({ id: "item-1", status: "done" })
        expect(decide).toHaveBeenCalledWith("user-1", "ws-1", {
            workItemId: "item-1",
            decision: "approved",
            edits: { fields: [{ name: "amount_vnd", number: 5 }] },
            note: undefined,
            basis: undefined,
            locale: "en",
        })
    })

    it("refuses a decision without a verdict", async () => {
        const { service, decide } = await build()

        await expect(
            service.run({ kind: "decide", workspaceId: "ws-1", member, payload: { workItemId: "item-1" } }),
        ).rejects.toMatchObject({ code: FlowEngineErrorCode.InvalidPayload })
        expect(decide).not.toHaveBeenCalled()
    })

    it("hands a rule to the decisions capability, which checks it against the catalogue", async () => {
        const { service, saveRule } = await build()
        const payload = { department: "sales", action: "send_quote", mode: "ask" }

        await service.run({ kind: "save_rule", workspaceId: "ws-1", member, payload })

        expect(saveRule).toHaveBeenCalledWith(
            "user-1",
            "ws-1",
            expect.objectContaining({ action: "send_quote", mode: "ask", required_fields: [] }),
        )
    })

    it("takes a conversation over and answers who handles it", async () => {
        const { service, setHandling } = await build()

        const result = await service.run({
            kind: "take_over",
            workspaceId: "ws-1",
            member,
            payload: { conversationId: "conv-1", take: true },
        })

        expect(setHandling).toHaveBeenCalledWith("user-1", "ws-1", "conv-1", true, "vi")
        expect(result.data).toEqual({ conversation_id: "conv-1", handled_by: "An" })
    })

    it("records a simulated input from the old snake_case fields", async () => {
        const { service, request } = await build()

        await service.run({
            kind: "simulate_inbound",
            workspaceId: "ws-1",
            member,
            payload: { channel: "zalo", kind: "message", sender_name: "Lan", body: "Hi" },
        })

        expect(request).toHaveBeenCalledWith(
            "user-1",
            "ws-1",
            expect.objectContaining({ senderName: "Lan", body: "Hi" }),
        )
    })

    it("hands an Office message to the owner chat", async () => {
        const { service, reply } = await build()

        const result = await service.run({
            kind: "owner_chat",
            workspaceId: "ws-1",
            member,
            payload: { text: "@nivo ok" },
        })

        expect(reply).toHaveBeenCalledWith(member, "@nivo ok", "vi")
        expect(result.data).toEqual({ handled: true, reply: "ok", posted: false })
    })
})
