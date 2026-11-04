import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { stepRowOf } from "@tests/fixtures/builders/agent-runs.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentStepQueue } from "@modules/queues/agent-step"
import { AgentRunParkStoreService } from "./agent-run-park-store.service"
import { AgentRunsErrorCode } from "./errors/agent-runs.error"
import { AgentRunStepEntity } from "./persistence/entities"

const call = (name: string, args: number): string =>
    `SELECT * FROM "public"."${name}"(${Array.from({ length: args }, (_, index) => `$${String(index + 1)}`).join(", ")})`

const build = async (em: MockEntityManager) => {
    const queue = mock<AgentStepQueue>({ enqueueAdvance: jest.fn().mockResolvedValue(undefined) })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunParkStoreService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AgentStepQueue, useValue: queue },
        ],
    }).compile()
    return { service: container.get(AgentRunParkStoreService), queue }
}

const WRITE = { runId: "run-1", actor: "member-1", reason: "fixed", auto: false, max: 5, backoffSeconds: 1800 }

describe("AgentRunParkStoreService.resumeRun", () => {
    it("resets the failed step and writes the job that drives it in one transaction", async () => {
        const em = mockEntityManager({
            query: [
                call("agent_run_resume", 7),
                [{ agent_run_resume: { result: "resumed", stepKey: "turn", workspaceId: "ws-1", at: 42 } }],
            ],
        })
        fakeTransaction(em)
        const { service, queue } = await build(em)

        await expect(service.resumeRun({ ...WRITE, input: { scope: "x" } })).resolves.toMatchObject({
            kind: "resumed",
            stepKey: "turn",
        })

        expect(em.query).toHaveBeenCalledWith(call("agent_run_resume", 7), [
            "run-1",
            "member-1",
            "fixed",
            '{"scope":"x"}',
            false,
            5,
            1800,
        ])
        expect(queue.enqueueAdvance).toHaveBeenCalledWith(
            { workspaceId: "ws-1", runId: "run-1" },
            "turn",
            "resume-42",
            expect.anything(),
        )
    })

    it("writes no job for a run it refused, and keeps the stored input when none is given", async () => {
        const em = mockEntityManager({
            query: [call("agent_run_resume", 7), [{ agent_run_resume: { result: "compensated" } }]],
        })
        fakeTransaction(em)
        const { service, queue } = await build(em)

        await expect(service.resumeRun(WRITE)).resolves.toEqual({ kind: "compensated" })

        expect(queue.enqueueAdvance).not.toHaveBeenCalled()
        expect(em.query).toHaveBeenCalledWith(call("agent_run_resume", 7), [
            "run-1",
            "member-1",
            "fixed",
            null,
            false,
            5,
            1800,
        ])
    })

    it("refuses an answer it cannot read", async () => {
        const em = mockEntityManager({ query: [call("agent_run_resume", 7), [{ agent_run_resume: { result: "?" } }]] })
        fakeTransaction(em)
        const { service } = await build(em)

        await expect(service.resumeRun(WRITE)).rejects.toMatchObject({ code: AgentRunsErrorCode.ResultRejected })
    })
})

describe("AgentRunParkStoreService parked runs", () => {
    it("marks the build a run parked under", async () => {
        const em = mockEntityManager({ query: [call("agent_run_park_mark", 2), [{ agent_run_park_mark: true }]] })
        const { service } = await build(em)

        await expect(service.markParked("run-1", "b2")).resolves.toBe(true)
        expect(em.query).toHaveBeenCalledWith(call("agent_run_park_mark", 2), ["run-1", "b2"])
    })

    it("asks for the parked runs a pass may take", async () => {
        const em = mockEntityManager({
            query: [call("agent_run_parked", 6), [{ parked_run: "run-1", parked_workspace: "ws-1" }]],
        })
        const { service } = await build(em)
        const query = { limit: 25, build: "b2", byBuild: true, minAgeSeconds: 0, max: 5, exclude: ["x"] }

        await expect(service.parked(query)).resolves.toEqual([{ runId: "run-1", workspaceId: "ws-1" }])
        expect(em.query).toHaveBeenCalledWith(call("agent_run_parked", 6), [25, "b2", true, 0, 5, ["x"]])
    })

    it("refuses rows it cannot read", async () => {
        const em = mockEntityManager({ query: [call("agent_run_parked", 6), [{ nope: 1 }]] })
        const { service } = await build(em)

        await expect(
            service.parked({ limit: 1, build: "", byBuild: false, minAgeSeconds: 0, max: 1, exclude: [] }),
        ).rejects.toMatchObject({ code: AgentRunsErrorCode.ResultRejected })
    })

    it("reads the first failed step of a run, or none", async () => {
        const em = mockEntityManager({
            findOne: [
                [AgentRunStepEntity, stepRowOf({ status: "failed", errorCode: "boom" })],
                [AgentRunStepEntity, null],
            ],
        })
        const { service } = await build(em)

        await expect(service.failedStepOf("run-1")).resolves.toMatchObject({ status: "failed", errorCode: "boom" })
        await expect(service.failedStepOf("run-1")).resolves.toBeNull()
    })
})
