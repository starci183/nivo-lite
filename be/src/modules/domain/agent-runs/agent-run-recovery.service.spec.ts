import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { ScopedTx } from "@modules/domain/entity-engine"
import type { MutationValues } from "@nivo-lite/agent-sdk/mutation"
import { CLOCK } from "@modules/platform/clock"
import { runRecordOf, runStepViewOf, stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { OWNER_HELD_ATTEMPTS, RUN_ABANDONED, AgentRunRecoveryService } from "./agent-run-recovery.service"
import { AgentRunParkStoreService } from "./agent-run-park-store.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import type { AgentStepHandler } from "./agent-runs.contracts"
import type { RunRecord } from "./agent-runs-records.contracts"
import { TOOL_OUTCOME_UNKNOWN } from "./policies/agent-runs.policy"

const SCOPE = mock<ScopedTx>({ workspaceId: "ws-1" })

const FAILED_VIEW = stepViewOf({
    stepKey: "claim-ack",
    nodeKey: "claim-ack",
    kind: "graph_node",
    status: "failed",
    input: { trigger: { text: "a" } },
})

const build = async (
    run: RunRecord,
    code: string | null = "GRAPH_NODES_EXECUTOR_MISSING",
    handler: Partial<AgentStepHandler> = {},
) => {
    const written: Array<MutationValues | null> = []
    const store = mock<AgentRunStoreService>({
        patchRunWith: jest.fn(
            async (
                _tx: ScopedTx,
                _runId: string,
                build: (run: RunRecord) => MutationValues | null | Promise<MutationValues | null>,
            ) => {
                const values = await build(run)
                written.push(values)
                return values === null ? null : run
            },
        ),
        viewsOf: jest.fn().mockResolvedValue([stepViewOf({ stepKey: "thread", status: "done" }), FAILED_VIEW]),
        stepsOf: jest
            .fn()
            .mockResolvedValue([runStepViewOf({ stepKey: "claim-ack", status: "failed", errorCode: code })]),
    })
    store.at.mockImplementation((_ws, _manager, work) => work(SCOPE))
    const parks = mock<AgentRunParkStoreService>({
        resumeRun: jest.fn().mockResolvedValue({
            kind: "resumed",
            stepKey: "claim-ack",
            workspaceId: "ws-1",
            errorCode: code,
            effectKey: "resume-3",
        }),
    })
    const handlers = mock<AgentRunHandlersService>({ of: jest.fn().mockReturnValue(handler) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRunRecoveryService,
            { provide: CLOCK, useValue: new FakeClock("2026-11-04T10:00:00.000Z") },
            { provide: AgentRunStoreService, useValue: store },
            { provide: AgentRunParkStoreService, useValue: parks },
            { provide: AgentRunHandlersService, useValue: handlers },
        ],
    }).compile()
    return { service: moduleRef.get(AgentRunRecoveryService), store, parks, written }
}

describe("AgentRunRecoveryService.keep", () => {
    it("takes a stopped run off the machine's resume passes, once", async () => {
        const parked = await build(runRecordOf({ status: "parked", resumeAttempts: 1 }))
        await expect(parked.service.keep("ws-1", "run-1")).resolves.toBe(true)
        expect(parked.written).toEqual([{ resumeAttempts: OWNER_HELD_ATTEMPTS }])

        const held = await build(runRecordOf({ status: "parked", resumeAttempts: OWNER_HELD_ATTEMPTS }))
        await expect(held.service.keep("ws-1", "run-1")).resolves.toBe(false)
        const running = await build(runRecordOf({ status: "running" }))
        await expect(running.service.keep("ws-1", "run-1")).resolves.toBe(false)
    })
})

describe("AgentRunRecoveryService.failedStepOf", () => {
    it("answers the failed step with its input and code, and null when no step failed", async () => {
        const { service, store } = await build(runRecordOf({ status: "parked" }))
        await expect(service.failedStepOf("ws-1", "run-1")).resolves.toEqual({
            stepKey: "claim-ack",
            nodeKey: "claim-ack",
            kind: "graph_node",
            errorCode: "GRAPH_NODES_EXECUTOR_MISSING",
            input: { trigger: { text: "a" } },
        })
        store.viewsOf.mockResolvedValue([])
        await expect(service.failedStepOf("ws-1", "run-1")).resolves.toBeNull()
    })
})

describe("AgentRunRecoveryService.retry", () => {
    it("resumes the failed step for a person with the input its handler read afresh and the caller's newest lines", async () => {
        const refresh = jest.fn().mockResolvedValue({ trigger: { text: "fresh" } })
        const { service, parks } = await build(runRecordOf({ status: "parked" }), "GRAPH_NODES_EXECUTOR_MISSING", {
            refresh,
        })

        const answer = await service.retry({
            workspaceId: "ws-1",
            runId: "run-1",
            actor: "member-1",
            reason: "retry",
            input: (current) => Promise.resolve({ ...current, extra: true }),
        })

        expect(answer).toEqual({ kind: "resumed", stepKey: "claim-ack", workspaceId: "ws-1" })
        expect(refresh).toHaveBeenCalledWith(FAILED_VIEW)
        expect(parks.resumeRun).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            runId: "run-1",
            actor: "member-1",
            reason: "retry",
            input: { trigger: { text: "fresh" }, extra: true },
            auto: false,
            max: 5,
            backoffSeconds: 0,
        })
    })

    it("builds on the stored input with no refresh, and keeps it when the caller adds nothing", async () => {
        const { service, parks } = await build(runRecordOf({ status: "parked" }))
        await service.retry({
            workspaceId: "ws-1",
            runId: "run-1",
            actor: "a",
            reason: "r",
            input: (current) => Promise.resolve({ ...current, more: 1 }),
        })
        await service.retry({ workspaceId: "ws-1", runId: "run-1", actor: "a", reason: "r" })
        expect(parks.resumeRun.mock.calls[0]?.[0].input).toEqual({ trigger: { text: "a" }, more: 1 })
        expect(parks.resumeRun.mock.calls[1]?.[0].input).toBeUndefined()
    })

    it("never runs again a step whose outcome is unknown, and answers a refused resume by its kind", async () => {
        const unknown = await build(runRecordOf({ status: "parked" }), TOOL_OUTCOME_UNKNOWN)
        await expect(
            unknown.service.retry({ workspaceId: "ws-1", runId: "run-1", actor: "a", reason: "r" }),
        ).resolves.toEqual({
            kind: "outcome_unknown",
        })
        expect(unknown.parks.resumeRun).not.toHaveBeenCalled()

        const refused = await build(runRecordOf({ status: "done" }))
        refused.parks.resumeRun
            .mockResolvedValueOnce({ kind: "not_parked" })
            .mockResolvedValueOnce({ kind: "superseded" })
        await expect(
            refused.service.retry({ workspaceId: "ws-1", runId: "run-1", actor: "a", reason: "r" }),
        ).resolves.toEqual({
            kind: "not_parked",
        })
        await expect(
            refused.service.retry({ workspaceId: "ws-1", runId: "run-1", actor: "a", reason: "r" }),
        ).resolves.toEqual({
            kind: "not_parked",
        })
    })
})

describe("AgentRunRecoveryService.abandon", () => {
    it("closes a stopped run as dead with why and who, off every pass for good", async () => {
        const { service, written } = await build(runRecordOf({ status: "parked" }))
        await expect(service.abandon("ws-1", "run-1", "member-1")).resolves.toBe("abandoned")
        expect(written).toEqual([
            {
                status: "dead",
                error: { code: RUN_ABANDONED, by: "member-1" },
                endedAt: "2026-11-04T10:00:00.000Z",
                resumeAttempts: OWNER_HELD_ATTEMPTS,
            },
        ])
        const done = await build(runRecordOf({ status: "done" }))
        await expect(done.service.abandon("ws-1", "run-1", "member-1")).resolves.toBe("not_held")
    })
})
