import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TeamChatRoomsService, lineKeyOf } from "@modules/domain/team-chat"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { DomainError } from "@modules/platform/errors"
import { stopCardKeyOf } from "./stop-cards.service"
import { StopAnswersService, stopOfLine } from "./stop-answers.service"
import type { StopReply } from "./stop-answers.service"
import { StopDoorService } from "./stop-door.service"
import { RunStopRecordsService } from "./run-stop-records.service"
import type { RunStop } from "./run-stop.contracts"

/** A stored stop as the stops' door reads it. */
const rowOf = (runId: string, stepKey: string, state: "open" | "resolved"): RunStop => ({
    id: `stop-${runId}-${stepKey}`,
    version: "1",
    runId,
    stepKey,
    agentId: "agent-1",
    workflowId: "wf-1",
    contactId: null,
    conversationId: null,
    kind: "ai_report",
    state,
    reason: "The transfer names no order",
    question: "Which order?",
    detail: { suggestions: [], facts: [] },
    cardMessageId: "msg-1",
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: "2026-11-10T09:00:00.000Z",
    resolvedAt: state === "resolved" ? "2026-11-10T09:10:00.000Z" : null,
})

const replyTo = (runId: string, stepKey: string, over: Partial<StopReply> = {}): StopReply => ({
    workspaceId: "ws-1",
    byUserId: "user-owner",
    lineKey: lineKeyOf(stopCardKeyOf(runId, stepKey)),
    messageId: "msg-9",
    text: "This is the deposit of order DH-1",
    at: "2026-11-10T09:05:00.000Z",
    ...over,
})

class RoleForbidden extends DomainError<"WORKSPACE_MEMBERS_ROLE_FORBIDDEN"> {}

const build = async (rows: ReadonlyArray<RunStop>, withChat = true) => {
    const stops = mock<RunStopRecordsService>({
        newest: jest.fn((_ws: string, state: string) => Promise.resolve(rows.filter((row) => row.state === state))),
    })
    const door = mock<StopDoorService>({ decide: jest.fn().mockResolvedValue({ outcome: "admitted", stepKey: "match" }) })
    const chat = mock<TeamChatRoomsService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            StopAnswersService,
            { provide: RunStopRecordsService, useValue: stops },
            { provide: StopDoorService, useValue: door },
            { provide: LOGGER, useValue: logger },
            ...(withChat ? [{ provide: TeamChatRoomsService, useValue: chat }] : []),
        ],
    }).compile()
    return { service: moduleRef.get(StopAnswersService), door, stops, chat, logger }
}

describe("StopAnswersService: the team chat's listener of replies", () => {
    it("registers itself with the team chat at start, and the reply it hears resumes the stop", async () => {
        const { service, chat, door, logger } = await build([rowOf("run-1", "match", "open")])

        service.onModuleInit()

        expect(chat.listenReplies).toHaveBeenCalledTimes(1)
        const listener = chat.listenReplies.mock.calls[0]?.[0]
        await listener?.(replyTo("run-1", "match"))
        expect(door.decide).toHaveBeenCalledTimes(1)
        expect(logger.info).toHaveBeenCalledWith("agent_threads.answered_in_chat", { runId: "run-1", outcome: "admitted" })
    })

    it("hears a reply to a line that is no stop's card as nothing: no door, no log", async () => {
        const { service, door, logger } = await build([rowOf("run-1", "match", "open")])

        await expect(service.heard(replyTo("run-x", "other"))).resolves.toBe(false)
        expect(door.decide).not.toHaveBeenCalled()
        expect(logger.info).not.toHaveBeenCalled()
    })

    it("tells a resume asked as true and any other outcome as false", async () => {
        const { service, door } = await build([rowOf("run-1", "match", "open")])
        await expect(service.heard(replyTo("run-1", "match"))).resolves.toBe(true)

        door.decide.mockResolvedValueOnce({ outcome: "stop_closed", stepKey: "match" } as never)
        await expect(service.heard(replyTo("run-1", "match"))).resolves.toBe(false)
    })

    it("hears nothing in an app with no team chat, and starts", async () => {
        const { service } = await build([], false)

        expect(() => service.onModuleInit()).not.toThrow()
    })
})

describe("StopAnswersService.replied: the founder's words in the team chat resume the stopped step", () => {
    it("hands the reply's own words and moment to the stop door as an answer of the person who wrote it", async () => {
        const { service, door } = await build([rowOf("run-9", "other", "open"), rowOf("run-1", "match", "open")])

        await expect(service.replied(replyTo("run-1", "match"))).resolves.toEqual({
            runId: "run-1",
            stepKey: "match",
            outcome: "admitted",
        })
        expect(door.decide).toHaveBeenCalledWith("user-owner", {
            workspaceId: "ws-1",
            runId: "run-1",
            stepKey: "match",
            action: "answer",
            text: "This is the deposit of order DH-1",
            at: "2026-11-10T09:05:00.000Z",
        })
    })

    it("reads the newest open stops, then the newest resolved ones, one bounded page each (by state and moment)", async () => {
        const { service, stops } = await build([rowOf("run-1", "match", "resolved")])

        await service.replied(replyTo("run-1", "match"))

        expect(stops.newest.mock.calls).toEqual([
            ["ws-1", "open", 50],
            ["ws-1", "resolved", 50],
        ])
    })

    it("tells a reply to the card of a resolved stop that it is closed, and resumes nothing", async () => {
        const { service, door } = await build([rowOf("run-1", "match", "resolved")])

        await expect(service.replied(replyTo("run-1", "match"))).resolves.toEqual({
            runId: "run-1",
            stepKey: "match",
            outcome: "stop_closed",
        })
        expect(door.decide).not.toHaveBeenCalled()
    })

    it("answers null for a reply to a line that is the card of no stop", async () => {
        const { service, door } = await build([rowOf("run-1", "match", "open")])

        await expect(service.replied(replyTo("run-1", "other-step"))).resolves.toBeNull()
        await expect(service.replied({ ...replyTo("run-1", "match"), lineKey: "agent-message:order-notice:o-1" })).resolves.toBeNull()
        expect(door.decide).not.toHaveBeenCalled()
    })

    it("keeps the stop as it is for a person who may not decide, and lets any other failure through", async () => {
        const { service, door } = await build([rowOf("run-1", "match", "open")])
        door.decide.mockRejectedValueOnce(new RoleForbidden({ code: "WORKSPACE_MEMBERS_ROLE_FORBIDDEN" }))

        await expect(service.replied(replyTo("run-1", "match"))).resolves.toMatchObject({ outcome: "not_allowed" })

        door.decide.mockRejectedValueOnce(new Error("database down"))
        await expect(service.replied(replyTo("run-1", "match"))).rejects.toThrow("database down")
    })

    it("answers invalid for a reply that carries no words", async () => {
        const { service, door } = await build([rowOf("run-1", "match", "open")])

        await expect(service.replied(replyTo("run-1", "match", { text: "  " }))).resolves.toMatchObject({ outcome: "invalid" })
        await expect(service.replied(replyTo("run-1", "match", { text: undefined }))).resolves.toMatchObject({ outcome: "invalid" })
        expect(door.decide).not.toHaveBeenCalled()
    })
})

describe("stopOfLine", () => {
    it("finds the stop whose card key is the replied line's, by run and step", () => {
        const stops = [{ runId: "r-1", stepKey: "a" }, { runId: "r-2", stepKey: "a" }] as unknown as ReadonlyArray<RunStop>
        expect(stopOfLine(stops, lineKeyOf("run-stuck:r-2:a"))?.runId).toBe("r-2")
        expect(stopOfLine(stops, lineKeyOf("run-stuck:r-3:a"))).toBeNull()
    })
})
