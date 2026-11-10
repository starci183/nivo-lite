import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import { agentRunStopEntity } from "@nivo-lite/blocks-core/entities"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { lineKeyOf } from "@modules/domain/team-chat"
import { DomainError } from "@modules/platform/errors"
import { stopCardKeyOf } from "./stop-cards.service"
import { StopAnswersService, stopOfLine } from "./stop-answers.service"
import type { StopReply } from "./stop-answers.service"
import { StopDoorService } from "./stop-door.service"
import type { RunStop } from "./run-stop.contracts"

/** A stored stop row as the entity engine lists it. */
const rowOf = (runId: string, stepKey: string, state: "open" | "resolved"): RecordRow =>
    ({
        id: `stop-${runId}-${stepKey}`,
        version: "1",
        createdAt: "2026-11-10T09:00:00.000Z",
        data: {
            runId,
            stepKey,
            agentId: "agent-1",
            workflowId: "wf-1",
            leadId: null,
            conversationId: null,
            kind: "ai_report",
            state,
            reason: "The transfer names no order",
            question: "Which order?",
            detail: { suggestions: [], facts: [] },
            cardMessageId: "msg-1",
            customerLines: { lines: [] },
            answers: { answers: [] },
            decision: null,
            repeats: 1,
            stoppedAt: "2026-11-10T09:00:00.000Z",
            resolvedAt: state === "resolved" ? "2026-11-10T09:10:00.000Z" : null,
        },
    }) as unknown as RecordRow

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

const build = async (rows: ReadonlyArray<RecordRow>) => {
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation(((_ws: string, work: (tx: unknown) => unknown) => work({})) as never)
    engine.list.mockImplementation(((_tx: unknown, query: { where: { value: string } }) =>
        Promise.resolve({
            rows: rows.filter((row) => row.data.state === query.where.value).map((row) => ({ row })),
        })) as never)
    const door = mock<StopDoorService>({ decide: jest.fn().mockResolvedValue({ outcome: "admitted", stepKey: "match" }) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            StopAnswersService,
            { provide: EntityEngineService, useValue: engine },
            { provide: StopDoorService, useValue: door },
        ],
    }).compile()
    return { service: moduleRef.get(StopAnswersService), door, engine }
}

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

    it("reads only lists an index serves (state_stopped), checked by the real validator", async () => {
        const { service, engine } = await build([rowOf("run-1", "match", "resolved")])

        await service.replied(replyTo("run-1", "match"))

        const catalog = new Map([[agentRunStopEntity.name, agentRunStopEntity]])
        expect(engine.list).toHaveBeenCalledTimes(2)
        expect(engine.list.mock.calls.flatMap(([, query]) => queryProblems(query, catalog))).toEqual([])
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

    it("answers null for a reply to a line that is the card of no stop: the old engine's freezes take it", async () => {
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
