import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { RunStopRecordsService, ThreadApprovalsService, ThreadResumeRequestsService } from "@modules/domain/agent-threads"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import type { MemberSeatRecord } from "@modules/domain/workspace-members"
import { approvalStopOf } from "@tests/fixtures/builders/agent-desk.builder"
import type { DeskAsker } from "./agent-desk.contracts"
import { DeskRunsService } from "./desk-runs.service"
import { DeskWaitingService } from "./desk-waiting.service"

const ASKER: DeskAsker = { workspaceId: "ws-1", memberId: "seat-1", locale: "vi" }

const SEAT: MemberSeatRecord = {
    memberId: "seat-1",
    userId: "u-1",
    role: "owner",
    displayName: "Anh Tu",
    status: "active",
}

const build = async () => {
    const stops = mock<RunStopRecordsService>()
    stops.newest.mockResolvedValue([
        approvalStopOf(),
        approvalStopOf({
            id: "stop-2",
            runId: "run-2",
            kind: "ai_report",
            question: "Which order?",
            detail: { suggestions: [], facts: [] },
        }),
        approvalStopOf({ id: "stop-3", runId: "run-3", agentId: "agent-2" }),
    ])
    const runs = mock<DeskRunsService>()
    runs.runsOf.mockResolvedValue([{ id: "run-1", status: "waiting", ask: "Change the phone", askedBy: "Anh Tu" }])
    const seats = mock<WorkspaceMemberSeatsService>()
    seats.seatById.mockResolvedValue(SEAT)
    const decisions = mock<ThreadApprovalsService>()
    decisions.verdict.mockResolvedValue({ kind: "decided", workItemId: "item-1", status: "done" })
    const threads = mock<ThreadResumeRequestsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DeskWaitingService,
            { provide: RunStopRecordsService, useValue: stops },
            { provide: DeskRunsService, useValue: runs },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: ThreadApprovalsService, useValue: decisions },
            { provide: ThreadResumeRequestsService, useValue: threads },
        ],
    }).compile()
    return { service: moduleRef.get(DeskWaitingService), stops, runs, seats, decisions, threads }
}

describe("DeskWaitingService: what of an agent waits on a person", () => {
    it("lists the agent's open stops, newest first, each with who asked for the run's work", async () => {
        const { service, stops, runs } = await build()

        const view = await service.waiting(ASKER, "agent-1")

        expect(view.count).toBe(2)
        expect(view.rows.map((row) => [row.id, row.askedBy, row.commands])).toEqual([
            ["item-1", "Anh Tu", ["decline", "approve"]],
            ["stop-2", null, []],
        ])
        expect(stops.newest).toHaveBeenCalledWith("ws-1", "open", 50)
        expect(runs.runsOf).toHaveBeenCalledWith("ws-1", "agent-1", ["run-1", "run-2"])
    })
})

describe("DeskWaitingService: a verdict goes through the thread approvals' one door", () => {
    it("decides an open approval of the agent as the seat", async () => {
        const { service, decisions, threads } = await build()

        await expect(service.decide(ASKER, "agent-1", { id: "item-1", verdict: "approve" })).resolves.toEqual({
            kind: "decided",
            status: "done",
        })
        await service.decide(ASKER, "agent-1", { id: "item-1", verdict: "decline" })
        expect(decisions.verdict.mock.calls).toEqual([
            [{ workspaceId: "ws-1", workItemId: "item-1", verdict: "approved", by: "seat-1", owner: true, locale: "vi" }, threads],
            [{ workspaceId: "ws-1", workItemId: "item-1", verdict: "refused", by: "seat-1", owner: true, locale: "vi" }, threads],
        ])
    })

    it("refuses what is no open approval of this agent, and an asker with no active seat, deciding nothing", async () => {
        const { service, seats, decisions } = await build()

        await expect(service.decide(ASKER, "agent-1", { id: "stop-2", verdict: "approve" })).resolves.toEqual({
            kind: "refused",
            code: "not_waiting_here",
        })
        await expect(service.decide(ASKER, "agent-2", { id: "item-9", verdict: "approve" })).resolves.toMatchObject({
            code: "not_waiting_here",
        })
        await expect(
            service.decide({ ...ASKER, memberId: null }, "agent-1", { id: "item-1", verdict: "approve" }),
        ).resolves.toEqual({
            kind: "refused",
            code: "no_seat",
        })
        seats.seatById.mockResolvedValueOnce({ ...SEAT, status: "disabled" })
        await expect(service.decide(ASKER, "agent-1", { id: "item-1", verdict: "approve" })).resolves.toMatchObject({
            code: "no_seat",
        })
        seats.seatById.mockResolvedValueOnce({ ...SEAT, role: "staff" })
        await expect(service.decide(ASKER, "agent-1", { id: "item-1", verdict: "decline" })).resolves.toEqual({
            kind: "refused",
            code: "not_allowed",
        })
        expect(decisions.verdict).not.toHaveBeenCalled()
    })

    it("answers a refusal of the approvals' door with its own code, and lets any other failure through", async () => {
        const { service, decisions } = await build()
        decisions.verdict.mockResolvedValueOnce({ kind: "refused", code: "not_waiting" })

        await expect(service.decide(ASKER, "agent-1", { id: "item-1", verdict: "approve" })).resolves.toEqual({
            kind: "refused",
            code: "not_waiting",
        })
        decisions.verdict.mockRejectedValueOnce({ reason: "socket closed" })
        await expect(service.decide(ASKER, "agent-1", { id: "item-1", verdict: "approve" })).rejects.toEqual({
            reason: "socket closed",
        })
    })
})
