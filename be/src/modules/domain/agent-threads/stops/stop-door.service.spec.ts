import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentRunCancelService, AgentRunsService, AgentRunsViewService } from "@modules/domain/agent-runs"
import type { RunView } from "@modules/domain/agent-runs"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { ThreadRunsService } from "../thread-runs.service"
import type { ThreadWakeAdmission } from "../thread-runs.service"
import { RunStopRecordsService } from "./run-stop-records.service"
import { RunStopsService } from "./run-stops.service"
import type { RunStop } from "./run-stop.contracts"
import { StopDoorService, cancelOfSkip, stopDecisionOfAsk, targetStopOf } from "./stop-door.service"

const NOW = "2026-11-10T10:00:00.000Z"
const ASK = { workspaceId: "ws-1", runId: "run-1" }

const stopOf = (over: Partial<RunStop> = {}): RunStop => ({
    id: "stop-1",
    version: "1",
    runId: "run-1",
    stepKey: "match",
    agentId: "agent-1",
    workflowId: "wf-1",
    leadId: null,
    conversationId: null,
    kind: "ai_report",
    state: "open",
    reason: "1,000 VND, the note names no order",
    question: "Which order is this for?",
    detail: { suggestions: [], facts: [] },
    cardMessageId: "msg-1",
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: "2026-11-10T09:00:00.000Z",
    resolvedAt: null,
    ...over,
})

const RUN = { id: "run-1", workspaceId: "ws-1", agentId: "agent-1" } as RunView

interface World {
    readonly run?: RunView | null
    readonly engine?: "legacy" | "langgraph"
    readonly stops?: ReadonlyArray<RunStop>
    readonly admission?: ThreadWakeAdmission
    readonly after?: RunStop | null
}

const build = async (world: World = {}) => {
    const clock = new FakeClock(new Date(NOW))
    const access = mock<AgentWorkAccessService>({ manager: jest.fn().mockResolvedValue("member-1") })
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    const runs = mock<AgentRunsService>({ runOf: jest.fn().mockResolvedValue(world.run === undefined ? RUN : world.run) })
    const view = mock<AgentRunsViewService>({
        detail: jest.fn().mockResolvedValue({ run: {}, engine: world.engine ?? "langgraph", steps: [] }),
    })
    const stops = world.stops ?? [stopOf()]
    const records = mock<RunStopRecordsService>({
        ofRun: jest.fn().mockResolvedValue(stops),
        byRunStep: jest.fn().mockResolvedValue(world.after === undefined ? (stops[0] ?? null) : world.after),
    })
    const threads = mock<ThreadRunsService>({
        resume: jest.fn().mockResolvedValue(world.admission ?? { kind: "admitted", fresh: true }),
    })
    const cancels = mock<AgentRunCancelService>()
    const conversations = mock<ChatConversationsService>({ setHolder: jest.fn().mockResolvedValue(undefined) })
    const runStops = mock<RunStopsService>({ leftoverWithdrawn: jest.fn().mockResolvedValue(true) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            StopDoorService,
            { provide: CLOCK, useValue: clock },
            { provide: AgentWorkAccessService, useValue: access },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentRunsService, useValue: runs },
            { provide: AgentRunsViewService, useValue: view },
            { provide: RunStopRecordsService, useValue: records },
            { provide: ThreadRunsService, useValue: threads },
            { provide: AgentRunCancelService, useValue: cancels },
            { provide: ChatConversationsService, useValue: conversations },
            { provide: RunStopsService, useValue: runStops },
        ],
    }).compile()
    return { door: moduleRef.get(StopDoorService), access, members, threads, records, conversations, cancels, runStops }
}

describe("StopDoorService: a person's decision on the stop of a thread run", () => {
    it("hands the founder's words to the thread runs as an answer by their member id, at the moment they gave them", async () => {
        const { door, access, threads } = await build()

        await expect(
            door.decide("user-1", { ...ASK, action: "answer", text: "This is the deposit of order DH-1", at: "2026-11-10T09:30:00.000Z" }),
        ).resolves.toEqual({ outcome: "admitted", stepKey: "match" })

        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(threads.resume).toHaveBeenCalledWith(ASK, {
            kind: "answer",
            text: "This is the deposit of order DH-1",
            by: "member-1",
            at: "2026-11-10T09:30:00.000Z",
        })
    })

    it("turns each button into its typed decision, at now when no moment is given", async () => {
        const { door, threads } = await build()

        for (const action of ["retry", "skip"] as const)
            await expect(door.decide("user-1", { ...ASK, action })).resolves.toEqual({ outcome: "admitted", stepKey: "match" })

        expect(threads.resume).toHaveBeenNthCalledWith(1, ASK, { kind: "retry", by: "member-1", at: NOW })
        expect(threads.resume).toHaveBeenNthCalledWith(2, ASK, { kind: "skip", by: "member-1", at: NOW })
    })

    it("on take over also hands the run's conversation to the person by name, once, when the wake is new", async () => {
        const told = await build({ stops: [stopOf({ conversationId: "conv-1" })] })
        await told.door.decide("user-1", { ...ASK, action: "take_over" })
        expect(told.threads.resume).toHaveBeenCalledWith(ASK, { kind: "take_over", by: "member-1", at: NOW })
        expect(told.conversations.setHolder).toHaveBeenCalledWith("ws-1", "conv-1", "Lan")

        const again = await build({ stops: [stopOf({ conversationId: "conv-1" })], admission: { kind: "admitted", fresh: false } })
        await expect(again.door.decide("user-1", { ...ASK, action: "take_over" })).resolves.toEqual({
            outcome: "already_admitted",
            stepKey: "match",
        })
        expect(again.conversations.setHolder).not.toHaveBeenCalled()

        const bankFed = await build()
        await bankFed.door.decide("user-1", { ...ASK, action: "take_over" })
        expect(bankFed.conversations.setHolder).not.toHaveBeenCalled()
    })

})

describe("StopDoorService: what is refused, and why", () => {
    it("refuses politely a decision for a stop already resolved, and resumes nothing", async () => {
        const { door, threads } = await build({ stops: [stopOf({ state: "resolved", resolvedAt: NOW })] })

        await expect(door.decide("user-1", { ...ASK, action: "answer", text: "ok" })).resolves.toEqual({
            outcome: "stop_closed",
            stepKey: "match",
        })
        await expect(door.decide("user-1", { ...ASK, action: "retry" })).resolves.toEqual({
            outcome: "stop_closed",
            stepKey: "match",
        })
        expect(threads.resume).not.toHaveBeenCalled()
    })

    // FX4 (D-P11-6): a stop skipped before items were withdrawn left its approval item open; a late decision on it withdraws it.
    it("a late decision on a resolved stop withdraws the approval item it left open, and still answers stop_closed", async () => {
        const { door, threads, runStops } = await build({ stops: [stopOf({ kind: "approval", state: "resolved", resolvedAt: NOW })] })

        await expect(door.decide("user-1", { ...ASK, action: "skip" })).resolves.toEqual({ outcome: "stop_closed", stepKey: "match" })

        expect(runStops.leftoverWithdrawn).toHaveBeenCalledWith(ASK, "match", { locale: "vi" })
        expect(threads.resume).not.toHaveBeenCalled()
    })

    it("says stop_closed when the stop resolved first, already_answered when another decision won, step_running while the step runs again", async () => {
        const closed = await build({
            admission: { kind: "refused", code: "thread_not_stopped" },
            after: stopOf({ state: "resolved" }),
        })
        await expect(closed.door.decide("user-1", { ...ASK, action: "retry" })).resolves.toMatchObject({ outcome: "stop_closed" })

        const answered = await build({ admission: { kind: "refused", code: "already_answered" }, after: stopOf() })
        await expect(answered.door.decide("user-1", { ...ASK, action: "skip" })).resolves.toEqual({
            outcome: "already_answered",
            stepKey: "match",
        })
        expect(answered.conversations.setHolder).not.toHaveBeenCalled()

        const running = await build({ admission: { kind: "refused", code: "thread_not_stopped" }, after: stopOf() })
        await expect(running.door.decide("user-1", { ...ASK, action: "retry" })).resolves.toMatchObject({ outcome: "step_running" })
    })

    it("leaves a run of the old engine to its own doors, and answers an unknown run as not found", async () => {
        const legacy = await build({ engine: "legacy" })
        await expect(legacy.door.decide("user-1", { ...ASK, action: "retry" })).resolves.toEqual({
            outcome: "not_thread",
            stepKey: null,
        })
        expect(legacy.threads.resume).not.toHaveBeenCalled()

        const missing = await build({ run: null })
        await expect(missing.door.decide("user-1", { ...ASK, action: "retry" })).resolves.toEqual({
            outcome: "not_found",
            stepKey: null,
        })
    })

    it("answers invalid for an unknown action or an answer with no words, and not_stopped for a run that never stopped", async () => {
        const { door, threads } = await build()
        await expect(door.decide("user-1", { ...ASK, action: "approve" })).resolves.toMatchObject({ outcome: "invalid" })
        await expect(door.decide("user-1", { ...ASK, action: "answer", text: "   " })).resolves.toMatchObject({ outcome: "invalid" })
        expect(threads.resume).not.toHaveBeenCalled()

        const never = await build({ stops: [] })
        await expect(never.door.decide("user-1", { ...ASK, action: "retry" })).resolves.toEqual({
            outcome: "not_stopped",
            stepKey: null,
        })
    })

    it("refuses (typed) a person who may not decide for the workspace before it reads anything", async () => {
        const { door, access, threads, records } = await build()
        access.manager.mockRejectedValue(Object.assign(new Error("not allowed"), { code: "WORKSPACE_MEMBERS_ROLE_FORBIDDEN" }))

        await expect(door.decide("user-2", { ...ASK, action: "skip" })).rejects.toMatchObject({
            code: "WORKSPACE_MEMBERS_ROLE_FORBIDDEN",
        })
        expect(records.ofRun).not.toHaveBeenCalled()
        expect(threads.resume).not.toHaveBeenCalled()
    })

    it("apply: a decision of a person the work engine already allowed goes through without a second access check", async () => {
        const { door, access, threads } = await build()

        await expect(door.apply({ memberId: "member-9", name: "Minh" }, { ...ASK, action: "retry" })).resolves.toMatchObject({
            outcome: "admitted",
        })
        expect(access.manager).not.toHaveBeenCalled()
        expect(threads.resume).toHaveBeenCalledWith(ASK, { kind: "retry", by: "member-9", at: NOW })
    })
})

describe("StopDoorService.skipRun: the run page's Cancel of a thread run", () => {
    const REQUEST = { principalId: "user-1", workspaceId: "ws-1", runId: "run-1" }

    it("registers with the runs' cancel door at start", async () => {
        const { door, cancels } = await build()

        door.onModuleInit()

        expect(cancels.setThreadStops).toHaveBeenCalledWith(door)
    })

    it("cancels a thread run by its stop's skip, as the same person; a closed stop is not cancellable", async () => {
        const { door, threads } = await build()
        await expect(door.skipRun(REQUEST)).resolves.toEqual({ kind: "cancelled", note: "effects_kept" })
        expect(threads.resume).toHaveBeenCalledWith(ASK, { kind: "skip", by: "member-1", at: NOW })

        const closed = await build({ stops: [stopOf({ state: "resolved" })] })
        await expect(closed.door.skipRun(REQUEST)).resolves.toEqual({ kind: "not_cancellable", note: null })
    })

    it("maps every outcome of the skip to the cancel's kinds", () => {
        expect(cancelOfSkip("already_admitted")).toEqual({ kind: "cancelled", note: "effects_kept" })
        expect(cancelOfSkip("not_found")).toEqual({ kind: "not_found", note: null })
        for (const outcome of ["already_answered", "stop_closed", "step_running", "not_stopped", "not_thread", "invalid"] as const)
            expect(cancelOfSkip(outcome)).toEqual({ kind: "not_cancellable", note: null })
    })
})

describe("targetStopOf / stopDecisionOfAsk", () => {
    const older = stopOf({ id: "s-a", stepKey: "a", stoppedAt: "2026-11-10T08:00:00.000Z" })
    const newer = stopOf({ id: "s-b", stepKey: "b", stoppedAt: "2026-11-10T09:00:00.000Z" })
    const closedOld = stopOf({ id: "s-c", stepKey: "c", state: "resolved", resolvedAt: "2026-11-10T07:00:00.000Z" })
    const closedNew = stopOf({ id: "s-d", stepKey: "d", state: "resolved", resolvedAt: "2026-11-10T09:59:00.000Z" })

    it("picks the named step's stop, else the open stop that stopped last, else the one resolved last", () => {
        expect(targetStopOf([older, newer], "a")?.id).toBe("s-a")
        expect(targetStopOf([older, newer], "zz")).toBeNull()
        expect(targetStopOf([older, closedNew, newer], null)?.id).toBe("s-b")
        expect(targetStopOf([closedOld, closedNew], null)?.id).toBe("s-d")
        expect(targetStopOf([], null)).toBeNull()
    })

    it("builds the stop's typed decisions; an answer needs words", () => {
        expect(stopDecisionOfAsk("answer", "m-1", NOW, "agreed")).toEqual({ kind: "answer", text: "agreed", by: "m-1", at: NOW })
        expect(stopDecisionOfAsk("skip", "m-1", NOW, "ignored")).toEqual({ kind: "skip", by: "m-1", at: NOW })
        expect(stopDecisionOfAsk("answer", "m-1", NOW, null)).toBeNull()
    })
})
