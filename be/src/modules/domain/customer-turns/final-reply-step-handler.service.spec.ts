import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { StepView } from "@modules/domain/agent-runs"
import { ChatTurnService } from "@modules/domain/conversations"
import type { CustomerTurn } from "@modules/domain/conversations"
import { CustomerDeliveryService } from "@modules/domain/work-performers"
import { FinalReplyStepHandlerService } from "./final-reply-step-handler.service"
import { FinalReplyService } from "./final-reply.service"
import { outputResultOf } from "./output-steps.policy"
import type { OutputScope } from "./output-steps.schema"

const SCOPE: OutputScope = {
    conversationId: "c1",
    messageId: "m1",
    approvedBy: null,
    workItemId: null,
    planned: "",
    declined: false,
    outputNode: "act:gateway_call",
    approvalNode: "ask:gateway_call",
    replyNode: "act:reply_customer",
}
const TURN = mock<CustomerTurn>()
Object.assign(TURN, { conversation: { workspaceId: "ws" } })
const STEP = { tool: "orders.draft", status: "ok", code: null, summary: "ORD-1" } as const

const viewOf = (scope: OutputScope): StepView => {
    const view = mock<StepView>()
    Object.assign(view, { input: scope, earlier: { "output:orders.draft:1": outputResultOf(STEP, scope) } })
    return view
}

const build = async (stored: string | null = null, send = true) => {
    const chat = mock<ChatTurnService>({
        turnOf: jest.fn().mockResolvedValue(TURN),
        settleLate: jest.fn().mockResolvedValue({ reply: "Drafted ORD-1", send, lines: [] }),
        sendReply: jest.fn().mockResolvedValue("acknowledged"),
    })
    const finals = mock<FinalReplyService>({
        write: jest.fn().mockResolvedValue("Drafted ORD-1"),
        declined: jest.fn().mockReturnValue("The shop will get back to you"),
    })
    const messages = mock<AgentMessagesService>({ storedReply: jest.fn().mockResolvedValue(stored) })
    const delivery = mock<CustomerDeliveryService>({ finalInConversation: jest.fn().mockResolvedValue("acknowledged") })
    const handlers = mock<AgentRunHandlersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            FinalReplyStepHandlerService,
            { provide: AgentRunHandlersService, useValue: handlers },
            { provide: ChatTurnService, useValue: chat },
            { provide: FinalReplyService, useValue: finals },
            { provide: AgentMessagesService, useValue: messages },
            { provide: CustomerDeliveryService, useValue: delivery },
        ],
    }).compile()
    return { handler: moduleRef.get(FinalReplyStepHandlerService), chat, finals, delivery, handlers }
}

describe("FinalReplyStepHandlerService", () => {
    it("registers the final reply kind with its exact implementation", async () => {
        const { handler, handlers } = await build()
        handler.onModuleInit()
        expect(handler.kind).toBe("final_reply")
        expect(handlers.add).toHaveBeenCalledWith(handler)
    })

    it("refuses an invalid stored input before loading a customer turn", async () => {
        const { handler, chat } = await build()
        await expect(handler.run(mock<StepView>({ input: {} }))).resolves.toEqual({
            kind: "failed",
            code: "invalid_input",
        })
        expect(chat.turnOf).not.toHaveBeenCalled()
    })

    it("writes from the stored results alone, passes the gate and sends under the message", async () => {
        const { handler, chat, finals } = await build()
        await expect(handler.run(viewOf(SCOPE))).resolves.toEqual({
            kind: "done",
            result: { reply: "Drafted ORD-1", sent: true, declined: false },
            next: [],
        })
        expect(finals.write).toHaveBeenCalledWith(TURN, [expect.objectContaining({ summary: "ORD-1" })], "m1", "")
        expect(chat.settleLate).toHaveBeenCalledWith(TURN, "Drafted ORD-1", "m1")
        expect(chat.sendReply).toHaveBeenCalledWith(TURN, "Drafted ORD-1")
    })

    it("delivers an approved output under its work item", async () => {
        const { handler, chat, delivery } = await build()
        await handler.run(viewOf({ ...SCOPE, workItemId: "w1", approvedBy: "An" }))
        expect(delivery.finalInConversation).toHaveBeenCalledWith("ws", "c1", "Drafted ORD-1", "w1")
        expect(chat.sendReply).not.toHaveBeenCalled()
    })

    it("resumes after a kill: a stored reply is sent once and neither written nor judged again", async () => {
        const { handler, chat, finals } = await build("Stored reply")
        await handler.run(viewOf(SCOPE))
        expect(finals.write).not.toHaveBeenCalled()
        expect(chat.settleLate).not.toHaveBeenCalled()
        expect(chat.sendReply).toHaveBeenCalledWith(TURN, "Stored reply")
    })

    it("keeps an inline reply retryable when delivery failed, reusing the stored body on the next attempt", async () => {
        const { handler, chat, finals } = await build("Stored reply")
        chat.sendReply.mockResolvedValueOnce("rejected")
        await expect(handler.run(viewOf(SCOPE))).resolves.toEqual({ kind: "retry", code: "delivery_unavailable" })
        await expect(handler.run(viewOf(SCOPE))).resolves.toEqual({
            kind: "done",
            result: { reply: "Stored reply", sent: true, declined: false },
            next: [],
        })
        expect(finals.write).not.toHaveBeenCalled()
        expect(chat.settleLate).not.toHaveBeenCalled()
        expect(chat.sendReply.mock.calls).toEqual([
            [TURN, "Stored reply"],
            [TURN, "Stored reply"],
        ])
    })

    it("retries an approved reply under its original item until its channel accepts it", async () => {
        const { handler, delivery, finals } = await build("Stored reply")
        delivery.finalInConversation.mockResolvedValueOnce("rejected")
        const scope = { ...SCOPE, workItemId: "w1", approvedBy: "An" }
        await expect(handler.run(viewOf(scope))).resolves.toEqual({ kind: "retry", code: "delivery_unavailable" })
        await expect(handler.run(viewOf(scope))).resolves.toMatchObject({ kind: "done", result: { sent: true } })
        expect(delivery.finalInConversation.mock.calls).toEqual([
            ["ws", "c1", "Stored reply", "w1"],
            ["ws", "c1", "Stored reply", "w1"],
        ])
        expect(finals.write).not.toHaveBeenCalled()
    })
})

describe("FinalReplyStepHandlerService", () => {
    it("holds an unacknowledged delivery for reconciliation instead of retrying or reporting sent", async () => {
        const { handler, chat, finals } = await build("Stored reply")
        chat.sendReply.mockResolvedValue("ambiguous")
        await expect(handler.run(viewOf(SCOPE))).resolves.toEqual({ kind: "failed", code: "delivery_outcome_unknown" })
        expect(finals.write).not.toHaveBeenCalled()
        expect(chat.settleLate).not.toHaveBeenCalled()
    })

    it("answers a no with the neutral line under the work item, with no model turn", async () => {
        const { handler, chat, finals, delivery } = await build()
        const declined = { ...SCOPE, workItemId: "w1", declined: true }
        await expect(handler.run(viewOf(declined))).resolves.toMatchObject({ result: { declined: true } })
        expect(finals.write).not.toHaveBeenCalled()
        expect(chat.settleLate).toHaveBeenCalledWith(TURN, "The shop will get back to you", "w1")
        expect(delivery.finalInConversation).toHaveBeenCalledWith("ws", "c1", "The shop will get back to you", "w1")
    })

    it("sends nothing the gate held", async () => {
        const { handler, chat } = await build(null, false)
        await expect(handler.run(viewOf(SCOPE))).resolves.toMatchObject({ result: { sent: false } })
        expect(chat.sendReply).not.toHaveBeenCalled()
    })

    it("fails when the customer message is gone", async () => {
        const { handler, chat } = await build()
        chat.turnOf.mockResolvedValue(undefined)
        await expect(handler.run(viewOf(SCOPE))).resolves.toEqual({ kind: "failed", code: "target_gone" })
    })
})
