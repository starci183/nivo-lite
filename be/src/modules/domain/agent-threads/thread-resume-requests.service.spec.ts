import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentRunsService, AgentRunsViewService } from "@modules/domain/agent-runs"
import type { RunView } from "@modules/domain/agent-runs"
import { AgentWakeService, AgentWorkReadService } from "@modules/domain/agent-work"
import { CustomerRoutesService } from "@modules/domain/customer-routes/customer-routes.service"
import type { AgentWake } from "@modules/domain/agent-work"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import type { RunStop, StopDecision } from "./stops/run-stop.contracts"
import { RunStopRecordsService } from "./stops/run-stop-records.service"
import { THREAD_RESUME_EVENT, THREAD_WAKE_SOURCE } from "./thread-wakes.policy"
import { ThreadResumeRequestsService, heldRouteEndedBy } from "./thread-resume-requests.service"

const AT = "2026-11-13T10:05:00.000Z"
const REF = { workspaceId: "ws-1", runId: "run-1" }
const MEMBER = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b"

const stopOf = (over: Partial<RunStop> = {}): RunStop => ({
    id: "stop-1",
    version: "3",
    runId: "run-1",
    stepKey: "answer",
    agentId: "agent-1",
    workflowId: "wf-1",
    contactId: null,
    conversationId: "conv-1",
    kind: "ai_report",
    state: "open",
    reason: "the price is not in the truths",
    question: "Which price?",
    detail: { suggestions: [], facts: [] },
    cardMessageId: "msg-1",
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: "2026-11-13T10:00:00.000Z",
    resolvedAt: null,
    ...over,
})

interface World {
    /** The run row; null for none. */
    readonly run?: RunView | null
    /** The engine the run row names. */
    readonly engine?: "legacy" | "langgraph"
    /** Where the run stands as its row says (the projection's word). */
    readonly status?: string
    /** The stops of the run. */
    readonly stops?: ReadonlyArray<RunStop>
}

/** The store-based admission: NO threads port, no graphs, no node host in the module (a missing one fails the compile). */
const build = async (world: World = {}) => {
    const run = world.run === undefined ? runViewOf({ context: { threadScope: "conversation:conv-1" } }) : world.run
    const stops = world.stops ?? [stopOf()]
    const runs = mock<AgentRunsService>({ runOf: jest.fn().mockResolvedValue(run) })
    const view = mock<AgentRunsViewService>({
        detail: jest.fn().mockResolvedValue({
            run: { status: world.status ?? "waiting" },
            engine: world.engine ?? "langgraph",
            steps: [],
        }),
    })
    const records = mock<RunStopRecordsService>({
        ofRun: jest.fn().mockResolvedValue(stops),
        byRunStep: jest.fn((_ws: string, _run: string, stepKey: string) =>
            Promise.resolve(stops.find((stop) => stop.stepKey === stepKey) ?? null),
        ),
    })
    const written: Array<AgentWake> = []
    const managers: Array<unknown> = []
    const wakes = mock<AgentWakeService>({
        write: jest.fn((manager: unknown, wake: AgentWake) => {
            managers.push(manager)
            const fresh = !written.some((one) => one.eventKey === wake.eventKey)
            if (fresh) written.push(wake)
            return Promise.resolve(fresh ? `wake-${written.length}` : null)
        }),
    })
    const reader = mock<AgentWorkReadService>({
        wakeContextOf: jest.fn((_ws: string, _agent: string, source: string, eventKey: string) =>
            Promise.resolve(written.find((one) => one.source === source && one.eventKey === eventKey)?.context ?? null),
        ),
    })
    const tx = fakeTransaction(mockEntityManager())
    const routes = mock<CustomerRoutesService>({ release: jest.fn().mockResolvedValue(null) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadResumeRequestsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: AgentRunsService, useValue: runs },
            { provide: AgentRunsViewService, useValue: view },
            { provide: AgentWakeService, useValue: wakes },
            { provide: RunStopRecordsService, useValue: records },
            { provide: AgentWorkReadService, useValue: reader },
            { provide: CustomerRoutesService, useValue: routes },
        ],
    }).compile()
    return { requests: moduleRef.get(ThreadResumeRequestsService), written, managers, tx, routes }
}

const retry = (by = "member-1"): StopDecision => ({ kind: "retry", by, at: AT })
const words = (text: string): StopDecision => ({ kind: "answer", text, by: "member-1", at: AT })

describe("ThreadResumeRequestsService: a person's answer to a stop, admitted from the stores and handed off as one resume wake", () => {
    it("records the verdict as ONE resume wake of the run's own scope, keyed by the stop and its answers, and reads no checkpoint", async () => {
        const { requests, written } = await build()
        const decision = words("Quote 120k")

        await expect(requests.resume({ ...REF, stepKey: "answer" }, decision)).resolves.toEqual({ kind: "admitted", fresh: true })

        expect(written).toEqual([
            {
                workspaceId: "ws-1",
                agentId: "agent-1",
                source: THREAD_WAKE_SOURCE,
                eventKey: "thread:run-1:answer:0",
                scopeKey: "conversation:conv-1",
                context: {
                    eventName: THREAD_RESUME_EVENT,
                    subjectId: "run-1",
                    tagContext: JSON.stringify({ decision, stepKey: "answer", answered: 0 }),
                },
                actorMemberId: null,
            },
        ])
    })

    it("writes in the caller's transaction when it hands one, else in its own", async () => {
        const own = await build()
        await own.requests.resume({ ...REF, stepKey: "answer" }, retry())
        expect(own.tx.outcomes).toEqual(["commit"])

        const theirs = await build()
        const tx = mockEntityManager()
        await theirs.requests.resume({ ...REF, stepKey: "answer" }, retry(), tx)
        expect(theirs.managers).toEqual([tx])
        expect(theirs.tx.outcomes).toEqual([])
    })

    it("answers the run's newest open stop when the caller names no step, and keys the wake by the answers it already holds", async () => {
        const older = stopOf({ stepKey: "match", state: "resolved", stoppedAt: "2026-11-13T09:00:00.000Z" })
        const open = stopOf({ stepKey: "answer", answers: [{ kind: "retry", text: null, by: "member-1", at: AT }] })
        const { requests, written } = await build({ stops: [older, open] })

        await requests.resume(REF, retry())

        expect(written.map((wake) => wake.eventKey)).toEqual(["thread:run-1:answer:1"])
    })

    it("puts only a member id (uuid) in the wake's actor column; any other `by` stays in the payload", async () => {
        const member = await build()
        await member.requests.resume({ ...REF, stepKey: "answer" }, retry(MEMBER))
        expect(member.written[0]?.actorMemberId).toBe(MEMBER)

        const engine = await build()
        await engine.requests.resume({ ...REF, stepKey: "answer" }, { kind: "timeout", at: AT })
        expect(engine.written[0]?.actorMemberId).toBeNull()
    })

    it("is once per stop state: the same decision again is the same wake, another decision loses as already answered", async () => {
        const { requests, written } = await build()
        const first = words("Quote 120k")

        await expect(requests.resume({ ...REF, stepKey: "answer" }, first)).resolves.toEqual({ kind: "admitted", fresh: true })
        await expect(requests.resume({ ...REF, stepKey: "answer" }, first)).resolves.toEqual({ kind: "admitted", fresh: false })
        await expect(requests.resume({ ...REF, stepKey: "answer" }, { kind: "skip", by: "member-2", at: AT })).resolves.toEqual({
            kind: "refused",
            code: "already_answered",
        })
        expect(written).toHaveLength(1)
    })

    it("refuses, with nothing written: no decision, no run, a run of the old engine, a run that names no scope", async () => {
        const invalid = await build()
        await expect(invalid.requests.resume({ ...REF, stepKey: "answer" }, { kind: "approve" })).resolves.toEqual({
            kind: "refused",
            code: "decision_invalid",
        })
        const missing = await build({ run: null })
        await expect(missing.requests.resume({ ...REF, stepKey: "answer" }, retry())).resolves.toEqual({
            kind: "refused",
            code: "run_missing",
        })
        const legacy = await build({ engine: "legacy" })
        await expect(legacy.requests.resume({ ...REF, stepKey: "answer" }, retry())).resolves.toEqual({
            kind: "refused",
            code: "run_not_thread",
        })
        const scopeless = await build({ run: runViewOf({ context: {} }) })
        await expect(scopeless.requests.resume({ ...REF, stepKey: "answer" }, retry())).resolves.toEqual({
            kind: "refused",
            code: "scope_unknown",
        })
        for (const world of [invalid, missing, legacy, scopeless]) expect(world.written).toEqual([])
    })

    it("refuses a stop that does not wait for a person: none at that step, resolved, or its step runs again (the run is not waiting)", async () => {
        const none = await build({ stops: [] })
        const resolved = await build({ stops: [stopOf({ state: "resolved" })] })
        const running = await build({ status: "running" })

        for (const world of [none, resolved, running]) {
            await expect(world.requests.resume({ ...REF, stepKey: "answer" }, retry())).resolves.toEqual({
                kind: "refused",
                code: "thread_not_stopped",
            })
            expect(world.written).toEqual([])
        }
    })
})

// Rulings R51, R52: closing a taken-over stop by ANY decision ends the staff hold that take-over set, in the resume door, with the wake.
describe("ThreadResumeRequestsService: a decision that closes a take-over ends its route's hold", () => {
    const taken = { kind: "take_over" as const, text: null, by: "member-1", at: AT }
    const takenOver = stopOf({ answers: [taken], decision: taken })
    const skip: StopDecision = { kind: "skip", by: "member-1", at: AT }

    it("clears the hold of the stop's route in the same transaction as the wake, for a retry, words, a skip and a hand-back's skip", async () => {
        for (const decision of [retry(), words("8h-21h"), skip]) {
            const own = await build({ stops: [takenOver] })
            await expect(own.requests.resume({ ...REF, stepKey: "answer" }, decision)).resolves.toEqual({ kind: "admitted", fresh: true })
            expect(own.routes.release).toHaveBeenCalledTimes(1)
            expect(own.routes.release).toHaveBeenCalledWith("ws-1", "conv-1", own.managers[0])
        }
        const theirs = await build({ stops: [takenOver] })
        const tx = mockEntityManager()
        await theirs.requests.resume({ ...REF, stepKey: "answer" }, skip, tx)
        expect(theirs.routes.release).toHaveBeenCalledWith("ws-1", "conv-1", tx)
    })

    it("leaves every hold alone: a stop never taken over, a take-over again, a run about no route, a refused or repeated decision", async () => {
        const fresh = await build()
        await fresh.requests.resume({ ...REF, stepKey: "answer" }, skip)
        expect(fresh.routes.release).not.toHaveBeenCalled()

        const again = await build({ stops: [takenOver] })
        await again.requests.resume({ ...REF, stepKey: "answer" }, { kind: "take_over", by: "member-1", at: AT })
        expect(again.routes.release).not.toHaveBeenCalled()

        const bankFed = await build({ stops: [stopOf({ conversationId: null, answers: [taken], decision: taken })] })
        await bankFed.requests.resume({ ...REF, stepKey: "answer" }, skip)
        expect(bankFed.routes.release).not.toHaveBeenCalled()

        const closed = await build({ stops: [stopOf({ state: "resolved", answers: [taken], decision: taken })] })
        await expect(closed.requests.resume({ ...REF, stepKey: "answer" }, skip)).resolves.toMatchObject({ kind: "refused" })
        expect(closed.routes.release).not.toHaveBeenCalled()

        const twice = await build({ stops: [takenOver] })
        await twice.requests.resume({ ...REF, stepKey: "answer" }, skip)
        await expect(twice.requests.resume({ ...REF, stepKey: "answer" }, retry())).resolves.toMatchObject({ code: "already_answered" })
        expect(twice.routes.release).toHaveBeenCalledTimes(1)
    })

    it("names the route only for a decision other than a take-over on a stop whose last decision is a take-over", () => {
        expect(heldRouteEndedBy({ decision: taken, conversationId: "conv-1" }, skip)).toBe("conv-1")
        expect(heldRouteEndedBy({ decision: taken, conversationId: "conv-1" }, taken)).toBeNull()
        expect(heldRouteEndedBy({ decision: null, conversationId: "conv-1" }, skip)).toBeNull()
        expect(heldRouteEndedBy({ decision: { kind: "retry" as const, text: null, by: "member-1", at: AT },conversationId: "conv-1" }, skip)).toBeNull()
        expect(heldRouteEndedBy({ decision: taken, conversationId: null }, skip)).toBeNull()
    })
})
