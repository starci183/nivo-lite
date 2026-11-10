import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { stuckKeyOf } from "@modules/domain/agent-graphs"
import { StopAnswersService, type StopReplied } from "@modules/domain/agent-threads"
import { lineKeyOf, TeamChatRoomsService } from "@modules/domain/team-chat"
import type { AgentLineReplied } from "@modules/domain/team-chat"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { frozenFreezeOf } from "@tests/fixtures/builders/lead-freezes.builder"
import { LeadFreezeAnswersService } from "./lead-freeze-answers.service"
import { LeadFreezeDoorService } from "./lead-freeze-door.service"
import { LeadFreezeRecordsService } from "./lead-freeze-records.service"
import { LeadFreezesLogEvent } from "./lead-freezes.log-events"
import type { LeadFreeze } from "./lead-freezes.contracts"

/** The reply of a person to the report the engine posted for the stuck step of a run. */
const replyTo = (runId: string, stepKey: string, byUserId = "user-owner"): AgentLineReplied => ({
    workspaceId: "ws-1",
    byUserId,
    lineKey: lineKeyOf(stuckKeyOf(runId, stepKey)),
})

const build = async (
    holding: ReadonlyArray<LeadFreeze> = [frozenFreezeOf()],
    withChat = true,
    stopReplied: StopReplied | null | undefined = undefined,
) => {
    const records = mock<LeadFreezeRecordsService>({ holding: jest.fn().mockResolvedValue(holding) })
    const door = mock<LeadFreezeDoorService>({ answer: jest.fn().mockResolvedValue({ outcome: "released" }) })
    const chat = mock<TeamChatRoomsService>()
    const logger = mock<Logger>()
    const stops = mock<StopAnswersService>({ replied: jest.fn().mockResolvedValue(stopReplied ?? null) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFreezeAnswersService,
            { provide: LeadFreezeRecordsService, useValue: records },
            { provide: LeadFreezeDoorService, useValue: door },
            { provide: LOGGER, useValue: logger },
            ...(withChat ? [{ provide: TeamChatRoomsService, useValue: chat }] : []),
            ...(stopReplied === undefined ? [] : [{ provide: StopAnswersService, useValue: stops }]),
        ],
    }).compile()
    return { service: moduleRef.get(LeadFreezeAnswersService), records, door, chat, logger, stops }
}

describe("LeadFreezeAnswersService.replied: the founder answers a stuck step in the team chat", () => {
    it("retries the freeze whose report the person replied to, through the freeze's door as that person", async () => {
        const other = frozenFreezeOf({ id: "freeze-2", frozenRunId: "run-2", stepKey: "mark-paid" })
        const { service, door, records, logger } = await build([frozenFreezeOf(), other])

        await expect(service.replied(replyTo("run-2", "mark-paid"))).resolves.toBe(true)

        expect(records.holding).toHaveBeenCalledWith("ws-1")
        expect(door.answer).toHaveBeenCalledTimes(1)
        expect(door.answer).toHaveBeenCalledWith("user-owner", {
            workspaceId: "ws-1",
            freezeId: "freeze-2",
            action: "retry",
            locale: "vi",
        })
        expect(logger.info).toHaveBeenCalledWith(LeadFreezesLogEvent.AnsweredInChat, {
            freezeId: "freeze-2",
            outcome: "released",
        })
    })

    it("retries again for a reply to a card that was folded (the same step stopped again): the fold keeps the line and its key", async () => {
        const { service, door } = await build()
        const foldedKey = lineKeyOf(stuckKeyOf("run-1", "claim-ack"))

        await expect(service.replied({ ...replyTo("run-1", "claim-ack"), lineKey: foldedKey })).resolves.toBe(true)
        await expect(service.replied({ ...replyTo("run-1", "claim-ack"), lineKey: foldedKey })).resolves.toBe(true)

        expect(door.answer).toHaveBeenCalledTimes(2)
    })

    it("changes nothing for a reply to a line that is no report of a stuck step, or to the report of another step of the run", async () => {
        const { service, door } = await build()

        await expect(service.replied({ ...replyTo("run-1", "claim-ack"), lineKey: "order-notice:o-1" })).resolves.toBe(false)
        await expect(service.replied(replyTo("run-1", "another-step"))).resolves.toBe(false)
        await expect(service.replied(replyTo("run-9", "claim-ack"))).resolves.toBe(false)

        expect(door.answer).not.toHaveBeenCalled()
    })

    it("asks no second retry while one runs, and none for a freeze that names no run or no step", async () => {
        const { service, door } = await build([
            frozenFreezeOf({ status: "retrying" }),
            frozenFreezeOf({ id: "freeze-2", frozenRunId: null }),
            frozenFreezeOf({ id: "freeze-3", frozenRunId: "run-3", stepKey: null }),
        ])

        await expect(service.replied(replyTo("run-1", "claim-ack"))).resolves.toBe(false)

        expect(door.answer).not.toHaveBeenCalled()
    })

    it("leaves the freeze as it is when the person may not decide for the workspace: their reply stays a message", async () => {
        const { service, door, logger } = await build()
        door.answer.mockRejectedValue(new Error("WORKSPACE_FORBIDDEN"))

        await expect(service.replied(replyTo("run-1", "claim-ack", "user-staff"))).resolves.toBe(false)

        expect(door.answer).toHaveBeenCalledWith("user-staff", expect.objectContaining({ freezeId: "freeze-1" }))
        expect(logger.info).toHaveBeenCalledWith(LeadFreezesLogEvent.AnsweredInChat, {
            freezeId: "freeze-1",
            outcome: "not_allowed",
        })
    })
})

describe("LeadFreezeAnswersService.replied: routing between the stops of thread runs and the old freezes", () => {
    it("hands a reply to the card of a thread run's stop to the stops, and never to the old freeze path", async () => {
        const stopped: StopReplied = { runId: "run-1", stepKey: "claim-ack", outcome: "admitted" }
        const { service, door, records, stops, logger } = await build([frozenFreezeOf()], true, stopped)

        await expect(service.replied(replyTo("run-1", "claim-ack"))).resolves.toBe(true)

        expect(stops.replied).toHaveBeenCalledWith(replyTo("run-1", "claim-ack"))
        expect(records.holding).not.toHaveBeenCalled()
        expect(door.answer).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith(LeadFreezesLogEvent.AnsweredInChat, { runId: "run-1", outcome: "admitted" })
    })

    it("answers false for a stop already resolved (nothing resumes) and for a person who may not decide", async () => {
        for (const outcome of ["stop_closed", "not_allowed", "step_running"] as const) {
            const { service, door } = await build([frozenFreezeOf()], true, { runId: "run-1", stepKey: "claim-ack", outcome })
            await expect(service.replied(replyTo("run-1", "claim-ack"))).resolves.toBe(false)
            expect(door.answer).not.toHaveBeenCalled()
        }
    })

    it("takes the old path unchanged when the reply is to the card of no stop", async () => {
        const { service, door, stops } = await build([frozenFreezeOf()], true, null)

        await expect(service.replied(replyTo("run-1", "claim-ack"))).resolves.toBe(true)

        expect(stops.replied).toHaveBeenCalledTimes(1)
        expect(door.answer).toHaveBeenCalledWith("user-owner", expect.objectContaining({ freezeId: "freeze-1", action: "retry" }))
    })
})

describe("LeadFreezeAnswersService registration", () => {
    it("listens to the replies of the team chat once the app has started, and hears nothing in an app without the chat", async () => {
        const { service, chat, door } = await build()

        service.onModuleInit()

        expect(chat.listenReplies).toHaveBeenCalledTimes(1)
        const listener = chat.listenReplies.mock.calls[0]?.[0]
        await expect(listener?.(replyTo("run-1", "claim-ack"))).resolves.toBeUndefined()
        expect(door.answer).toHaveBeenCalledWith("user-owner", expect.objectContaining({ action: "retry" }))

        const bare = await build([frozenFreezeOf()], false)
        expect(() => bare.service.onModuleInit()).not.toThrow()
        expect(bare.chat.listenReplies).not.toHaveBeenCalled()
    })
})
