import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentRunCancelService, AgentRunsService, AgentRunsViewService } from "@modules/domain/agent-runs"
import type { RunView } from "@modules/domain/agent-runs"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { ThreadResumeRequestsService } from "../thread-resume-requests.service"
import type { ThreadWakeAdmission } from "../thread-runs.service"
import { RunStopRecordsService } from "./run-stop-records.service"
import { RunStopsService } from "./run-stops.service"
import type { RunStop } from "./run-stop.contracts"
import { CustomerRoutesService } from "@modules/domain/customer-routes/customer-routes.service"
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
    contactId: null,
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
    const threads = mock<ThreadResumeRequestsService>({
        resume: jest.fn().mockResolvedValue(world.admission ?? { kind: "admitted", fresh: true }),
    })
    const cancels = mock<AgentRunCancelService>()
    const runStops = mock<RunStopsService>({ leftoverWithdrawn: jest.fn().mockResolvedValue(true) })
    // The staff hold of the routes (ruling R43): the take-over makes the person the holder of the run's route.
    const routes = mock<CustomerRoutesService>({ hold: jest.fn().mockResolvedValue("held") })
    const moduleRef = await Test.createTestingModule({
        providers: [
            StopDoorService,
            { provide: CLOCK, useValue: clock },
            { provide: AgentWorkAccessService, useValue: access },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentRunsService, useValue: runs },
            { provide: AgentRunsViewService, useValue: view },
            { provide: RunStopRecordsService, useValue: records },
            { provide: ThreadResumeRequestsService, useValue: threads },
            { provide: AgentRunCancelService, useValue: cancels },
            { provide: RunStopsService, useValue: runStops },
            { provide: CustomerRoutesService, useValue: routes },
        ],
    }).compile()
    return { door: moduleRef.get(StopDoorService), access, members, threads, records, cancels, runStops, routes }
}

describe("StopDoorService: a retry on a stop that waits for the owner's verdict on a permission request", () => {
    /** An approval stop whose owner item still waits (no verdict kept). */
    const waiting = stopOf({
        id: "stop-approval",
        stepKey: "send-qr",
        kind: "approval",
        question: null,
        conversationId: "conv-1",
        detail: { suggestions: [], facts: [{ name: "workItemId", value: "item-1" }, { name: "tool", value: "nivo.tool.payment.transfer.create" }] },
    })
    const withVerdict = (verdict: string): RunStop => ({
        ...waiting,
        detail: { ...waiting.detail, facts: [...waiting.detail.facts, { name: "verdict", value: verdict }] },
    })

    it("is refused before any side effect: no wake, nothing withdrawn, and the answer names the door for the verdict", async () => {
        const { door, threads, runStops, records } = await build({ stops: [waiting] })

        const answer = await door.decide("user-1", { ...ASK, stepKey: "send-qr", action: "retry" })

        expect(answer).toEqual({
            outcome: "approval_pending",
            stepKey: "send-qr",
            refusal: { stopId: "stop-approval", workItemId: "item-1", door: "decideAgentRunStep", verdicts: ["approve", "reject"] },
        })
        expect(threads.resume).not.toHaveBeenCalled()
        expect(runStops.leftoverWithdrawn).not.toHaveBeenCalled()
        // The door read the stop once and wrote nothing: the approval still waits as it did.
        expect(records.byRunStep).not.toHaveBeenCalled()
    })

    it("is refused for the work engine's own caller too (`apply`), and when no step is named (the run's open stop)", async () => {
        const { door, threads } = await build({ stops: [waiting] })

        await expect(door.apply({ memberId: "member-9", name: "Minh" }, { ...ASK, action: "retry" })).resolves.toMatchObject({
            outcome: "approval_pending",
            stepKey: "send-qr",
        })
        expect(threads.resume).not.toHaveBeenCalled()
    })

    it("a retry goes through once the item's verdict is kept on the stop (the approval door's own resume), and on any stop that is no approval", async () => {
        const approved = await build({ stops: [withVerdict("approved:member-owner")] })
        const withdrawn = await build({ stops: [withVerdict("withdrawn")] })
        const report = await build()

        await expect(approved.door.decide("user-1", { ...ASK, action: "retry" })).resolves.toEqual({ outcome: "admitted", stepKey: "send-qr" })
        await expect(withdrawn.door.decide("user-1", { ...ASK, action: "retry" })).resolves.toEqual({ outcome: "admitted", stepKey: "send-qr" })
        await expect(report.door.decide("user-1", { ...ASK, action: "retry" })).resolves.toEqual({ outcome: "admitted", stepKey: "match" })
        expect(report.threads.resume).toHaveBeenCalledWith({ ...ASK, stepKey: "match" }, { kind: "retry", by: "member-1", at: NOW })
    })

    it("the founder's words are refused the same way: nothing withdrawn, no wake, the door for the verdict named", async () => {
        const { door, threads, runStops } = await build({ stops: [waiting] })

        const answer = await door.decide("user-1", { ...ASK, action: "answer", text: "Cu gui di", at: "2026-11-10T09:30:00.000Z" })

        expect(answer).toMatchObject({ outcome: "approval_pending", stepKey: "send-qr", refusal: { door: "decideAgentRunStep", workItemId: "item-1" } })
        expect(threads.resume).not.toHaveBeenCalled()
        expect(runStops.declinedByTakeOver).not.toHaveBeenCalled()
    })

    it("a take-over declines the request first, by the person, then takes the stop as on any other", async () => {
        const { door, threads, runStops } = await build({ stops: [waiting] })
        const order: Array<string> = []
        runStops.declinedByTakeOver.mockImplementation(() => {
            order.push("declined")
            return Promise.resolve(true)
        })
        threads.resume.mockImplementation(() => {
            order.push("take_over")
            return Promise.resolve({ kind: "admitted", fresh: true })
        })

        const answer = await door.decide("user-1", { ...ASK, action: "take_over" })

        expect(answer).toEqual({ outcome: "admitted", stepKey: "send-qr" })
        expect(order).toEqual(["declined", "take_over"])
        expect(runStops.declinedByTakeOver).toHaveBeenCalledWith(ASK, "send-qr", { memberId: "member-1", name: "Lan" }, { locale: "vi" })
        expect(threads.resume).toHaveBeenCalledWith({ ...ASK, stepKey: "send-qr" }, { kind: "take_over", by: "member-1", at: NOW })
    })

    it("words and a take-over on a stop that is NO permission request go as before, and decline nothing", async () => {
        const { door, threads, runStops } = await build()

        await expect(door.decide("user-1", { ...ASK, action: "answer", text: "Don DH-1" })).resolves.toEqual({ outcome: "admitted", stepKey: "match" })
        await expect(door.decide("user-1", { ...ASK, action: "take_over" })).resolves.toEqual({ outcome: "admitted", stepKey: "match" })

        expect(threads.resume).toHaveBeenCalledTimes(2)
        expect(runStops.declinedByTakeOver).not.toHaveBeenCalled()
    })

    it("the run page's cancel (skip) of a run that waits on an approval is still taken: ending the run is its own, named act", async () => {
        const { door, threads } = await build({ stops: [waiting] })

        await expect(door.decide("user-1", { ...ASK, action: "skip" })).resolves.toEqual({ outcome: "admitted", stepKey: "send-qr" })
        expect(threads.resume).toHaveBeenCalledWith({ ...ASK, stepKey: "send-qr" }, { kind: "skip", by: "member-1", at: NOW })
    })
})

describe("StopDoorService: a person's decision on the stop of a thread run", () => {
    it("hands the founder's words to the thread runs as an answer by their member id, at the moment they gave them", async () => {
        const { door, access, threads } = await build()

        await expect(
            door.decide("user-1", { ...ASK, action: "answer", text: "This is the deposit of order DH-1", at: "2026-11-10T09:30:00.000Z" }),
        ).resolves.toEqual({ outcome: "admitted", stepKey: "match" })

        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(threads.resume).toHaveBeenCalledWith({ ...ASK, stepKey: "match" }, {
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

        expect(threads.resume).toHaveBeenNthCalledWith(1, { ...ASK, stepKey: "match" }, { kind: "retry", by: "member-1", at: NOW })
        expect(threads.resume).toHaveBeenNthCalledWith(2, { ...ASK, stepKey: "match" }, { kind: "skip", by: "member-1", at: NOW })
    })

    it("on take over resumes the run as the person's decision and writes no chat record (the door binds no chat service at all); a repeated admission is answered as such", async () => {
        const told = await build({ stops: [stopOf({ conversationId: "route-1" })] })
        await expect(told.door.decide("user-1", { ...ASK, action: "take_over" })).resolves.toEqual({ outcome: "admitted", stepKey: "match" })
        expect(told.threads.resume).toHaveBeenCalledWith({ ...ASK, stepKey: "match" }, { kind: "take_over", by: "member-1", at: NOW })

        const again = await build({ stops: [stopOf({ conversationId: "route-1" })], admission: { kind: "admitted", fresh: false } })
        await expect(again.door.decide("user-1", { ...ASK, action: "take_over" })).resolves.toEqual({
            outcome: "already_admitted",
            stepKey: "match",
        })
    })

    it("on an admitted take over makes the person the holder of the run's route (ruling R43), and the same on a repeated admission", async () => {
        const told = await build({ stops: [stopOf({ conversationId: "route-1" })] })
        await told.door.decide("user-1", { ...ASK, action: "take_over" })
        expect(told.routes.hold).toHaveBeenCalledWith("ws-1", "route-1", "member-1")

        const again = await build({ stops: [stopOf({ conversationId: "route-1" })], admission: { kind: "admitted", fresh: false } })
        await again.door.decide("user-1", { ...ASK, action: "take_over" })
        expect(again.routes.hold).toHaveBeenCalledWith("ws-1", "route-1", "member-1")
    })

    it("holds no route for a take over the thread refused, for another button, or for a run about no route", async () => {
        const refused = await build({ stops: [stopOf({ conversationId: "route-1" })], admission: { kind: "refused", code: "already_answered" } })
        await expect(refused.door.decide("user-1", { ...ASK, action: "take_over" })).resolves.toMatchObject({ outcome: "already_answered" })
        expect(refused.routes.hold).not.toHaveBeenCalled()

        const retried = await build({ stops: [stopOf({ conversationId: "route-1" })] })
        await retried.door.decide("user-1", { ...ASK, action: "retry" })
        expect(retried.routes.hold).not.toHaveBeenCalled()

        const bankFed = await build({ stops: [stopOf({ conversationId: null })] })
        await expect(bankFed.door.decide("user-1", { ...ASK, action: "take_over" })).resolves.toMatchObject({ outcome: "admitted" })
        expect(bankFed.routes.hold).not.toHaveBeenCalled()
    })

    // Ruling R52 moved the clearing of a take-over's hold out of this door into the ONE resume door (`heldRouteEndedBy`, every caller:
    // retry, words, skip, the run page's cancel, a hand-back), written with the wake; its spec is `thread-resume-requests.service.spec`.
    // This door only sets the hold, and releases nothing itself.
    it("releases no hold itself for any decision on a stop a person took over: the resume door ends it (ruling R52)", async () => {
        const taken = { kind: "take_over" as const, text: null, by: "member-1", at: NOW }
        for (const action of ["retry", "answer", "skip"] as const) {
            const world = await build({ stops: [stopOf({ conversationId: "route-1", decision: taken, answers: [taken] })] })
            await expect(world.door.decide("user-1", { ...ASK, action, text: "8h-21h" })).resolves.toMatchObject({ outcome: "admitted" })
            expect(world.threads.resume).toHaveBeenCalledWith({ ...ASK, stepKey: "match" }, expect.objectContaining({ kind: action }))
            expect(world.routes.release).not.toHaveBeenCalled()
        }
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
        expect(threads.resume).toHaveBeenCalledWith({ ...ASK, stepKey: "match" }, { kind: "retry", by: "member-9", at: NOW })
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
        expect(threads.resume).toHaveBeenCalledWith({ ...ASK, stepKey: "match" }, { kind: "skip", by: "member-1", at: NOW })

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
