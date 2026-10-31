import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { runtimeTurn } from "@tests/fixtures/builders/customer-turn-runtime.builder"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import type { AgentTurnPlan } from "@modules/domain/agent-work"
import { ChatTurnService } from "@modules/domain/conversations"
import type { CustomerTurn } from "@modules/domain/conversations"
import { CLOCK } from "@modules/platform/clock"
import { CustomerCorePlanService } from "./customer-core-plan.service"
import { CustomerTurnRuntimeService } from "./customer-turn-runtime.service"
import { CustomerWorkHandlerService } from "./customer-work-handler.service"

const NOW = Date.parse("2026-11-10T03:00:00.000Z")

const CONTEXT = { conversationId: "c1", messageId: "m1", channelEventId: "tg:42:1" }

const PLAN: AgentTurnPlan = {
    module: "chatbot",
    runtimeAgentId: "ws-chatbot",
    threadKey: "agent:ws-chatbot:c1",
    message: "the words",
    timeoutMs: 25_000,
}

const ORIGIN = { turnId: "turn-1", wakeId: "wake-1" }

const wakeOf = (patch: { readonly context?: Record<string, unknown>; readonly ageMs?: number } = {}) =>
    agentTurnViewOf({
        context: patch.context ?? { ...CONTEXT, lookupName: false },
        wakeCreatedAt: new Date(NOW - (patch.ageMs ?? 1_000)),
    })

const build = async (loaded: CustomerTurn | null = runtimeTurn) => {
    const chat = mock<ChatTurnService>()
    chat.turnOf.mockResolvedValue(loaded ?? undefined)
    chat.answeredByPerson.mockReturnValue(false)
    chat.ready.mockImplementation((turn) => Promise.resolve(turn))
    chat.respond.mockResolvedValue(undefined)
    chat.holdOver.mockResolvedValue(undefined)
    const runtime = mock<CustomerTurnRuntimeService>()
    const plans = mock<CustomerCorePlanService>()
    plans.planOf.mockResolvedValue(PLAN)
    runtime.proposalFrom.mockReturnValue({
        reply: "50k",
        needsHuman: false,
        reason: "",
        proposedAnswer: "",
        detail: {},
    })
    const handlers = mock<AgentWorkHandlersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerWorkHandlerService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AgentWorkHandlersService, useValue: handlers },
            { provide: ChatTurnService, useValue: chat },
            { provide: CustomerTurnRuntimeService, useValue: runtime },
            { provide: CustomerCorePlanService, useValue: plans },
        ],
    }).compile()
    return { handler: moduleRef.get(CustomerWorkHandlerService), chat, runtime, plans, handlers }
}

describe("CustomerWorkHandlerService registration", () => {
    it("answers customer wakes and registers itself with the drain when the app starts", async () => {
        const { handler, handlers } = await build()

        handler.onModuleInit()

        expect(handler.sources).toEqual(["customer"])
        expect(handlers.add).toHaveBeenCalledWith(handler)
    })
})

describe("CustomerWorkHandlerService.prepare", () => {
    it("plans a turn for a conversation the engine holds: typing is shown and the customer is named when just met", async () => {
        const { handler, chat, plans } = await build()

        await expect(handler.prepare(wakeOf({ context: { ...CONTEXT, lookupName: true } }))).resolves.toEqual({
            kind: "run",
            plan: PLAN,
        })

        expect(chat.turnOf).toHaveBeenCalledWith({ conversationId: "c1", messageId: "m1", channelEventId: "tg:42:1" })
        expect(chat.ready).toHaveBeenCalledWith(runtimeTurn, true)
        expect(plans.planOf).toHaveBeenCalledWith(runtimeTurn)
    })

    it("ends the wake as skipped when the message is gone or the wake names none", async () => {
        const gone = await build(null)
        const unnamed = await build()

        await expect(gone.handler.prepare(wakeOf())).resolves.toMatchObject({
            kind: "end",
            ending: { status: "skipped", reason: "target_gone" },
        })
        await expect(unnamed.handler.prepare(wakeOf({ context: {} }))).resolves.toMatchObject({
            kind: "end",
            ending: { status: "skipped", reason: "target_gone" },
        })
        expect(unnamed.chat.turnOf).not.toHaveBeenCalled()
    })

    it("leaves a conversation a person took over to that person: no typing, no holding line", async () => {
        const { handler, chat, plans } = await build()
        chat.answeredByPerson.mockReturnValue(true)

        await expect(handler.prepare(wakeOf())).resolves.toMatchObject({
            kind: "end",
            ending: { status: "skipped", reason: "taken_over" },
        })
        expect(chat.ready).not.toHaveBeenCalled()
        expect(chat.holdOver).not.toHaveBeenCalled()
        expect(plans.planOf).not.toHaveBeenCalled()
    })

    it("holds over a wake older than ten minutes instead of answering a question from long ago", async () => {
        const { handler, chat, plans } = await build()

        await expect(handler.prepare(wakeOf({ ageMs: 10 * 60_000 + 1 }))).resolves.toMatchObject({
            kind: "end",
            ending: { status: "done", reason: "stale" },
        })

        expect(chat.holdOver).toHaveBeenCalledWith({ ...runtimeTurn, origin: ORIGIN }, "stale_wake")
        expect(chat.ready).not.toHaveBeenCalled()
        expect(plans.planOf).not.toHaveBeenCalled()
        expect(plans.end).toHaveBeenCalledWith(runtimeTurn)
    })

    it("answers a wake of exactly ten minutes", async () => {
        const { handler } = await build()

        await expect(handler.prepare(wakeOf({ ageMs: 10 * 60_000 }))).resolves.toMatchObject({ kind: "run" })
    })

    it("holds over with the reason the runtime gives when the agent does not run", async () => {
        const { handler, chat, plans } = await build()
        plans.planOf.mockResolvedValue("needs_connection")

        await expect(handler.prepare(wakeOf())).resolves.toMatchObject({
            kind: "end",
            ending: { status: "done", reason: "needs_connection" },
        })
        expect(chat.holdOver).toHaveBeenCalledWith(expect.anything(), "needs_connection")
    })
})

describe("CustomerWorkHandlerService.settle", () => {
    it("reads the stored text as the proposal and answers it through the shared code, carrying the turn and wake", async () => {
        const { handler, chat, runtime, plans } = await build()

        await expect(handler.settle(wakeOf(), { text: "the model words" })).resolves.toEqual({
            status: "done",
            reason: null,
            outcome: { replied: true },
        })

        expect(runtime.proposalFrom).toHaveBeenCalledWith("the model words")
        expect(chat.respond).toHaveBeenCalledWith(
            { ...runtimeTurn, origin: ORIGIN },
            expect.objectContaining({ reply: "50k" }),
        )
        expect(plans.end).toHaveBeenCalledWith(runtimeTurn)
    })

    it("treats a stored proposal with no text as an empty one, which the reading turns into a question for a person", async () => {
        const { handler, runtime } = await build()

        await handler.settle(wakeOf(), null)

        expect(runtime.proposalFrom).toHaveBeenCalledWith("")
    })

    it("ends as skipped when the message is gone by then", async () => {
        const { handler, chat } = await build(null)

        await expect(handler.settle(wakeOf(), { text: "x" })).resolves.toMatchObject({
            status: "skipped",
            reason: "target_gone",
        })
        expect(chat.respond).not.toHaveBeenCalled()
    })
})

describe("CustomerWorkHandlerService.holdOver", () => {
    it.each([
        ["quota", "quota_exceeded"],
        ["breaker", "openclaw_unavailable"],
        ["openclaw_unavailable", "openclaw_unavailable"],
        ["openclaw_not_configured", "openclaw_not_configured"],
        ["killed", "installation_not_running"],
    ])("says %s to the outcome handler as %s, like the legacy road", async (reason, legacy) => {
        const { handler, chat } = await build()

        await expect(handler.holdOver(wakeOf(), reason)).resolves.toEqual({
            status: "done",
            reason,
            outcome: { heldOver: true },
        })
        expect(chat.holdOver).toHaveBeenCalledWith(expect.objectContaining({ messageId: "m1" }), legacy)
    })

    it("ends as skipped when the message is gone", async () => {
        const { handler, chat } = await build(null)

        await expect(handler.holdOver(wakeOf(), "quota")).resolves.toMatchObject({ status: "skipped" })
        expect(chat.holdOver).not.toHaveBeenCalled()
    })
})
