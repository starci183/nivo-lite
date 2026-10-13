import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AutomationRunsService } from "./automation-runs.service"
import type { ClaimedRun } from "./automation-runs.contracts"
import { AutomationRunsLogEvent } from "./automation-runs.log-events"
import {
    CLAIM_RUN,
    FAIL_RUN,
    FINISH_RUN,
    INSERT_RUN,
    SELECT_DUE_RUNS,
    SELECT_LATEST_DONE_RUN,
    SELECT_PRIOR_RUNS,
    SELECT_RUNS,
    SELECT_WAITING_RUNS,
    UPDATE_RUN_PAYLOAD,
} from "./persistence/automation-runs.sql"

const NOW = "2026-10-12T10:00:00.000Z"

const build = async (em: MockEntityManager) => {
    const clock = new FakeClock(NOW)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockReturnValue("Loi")
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationRunsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: clock },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { runs: moduleRef.get(AutomationRunsService), logger }
}

const BEGIN = {
    pipelineId: "p-1",
    workspaceId: "ws-1",
    dedupe: "d-1",
    triggerRef: "t-1",
    payload: { a: 1 },
    runAt: undefined,
}

describe("AutomationRunsService", () => {
    describe("beginRun", () => {
        it("stores a running run at once and answers it", async () => {
            const em = mockEntityManager({ query: [INSERT_RUN, [{ id: "r-1", attempts: 1 }]] })
            const { runs } = await build(em)

            await expect(runs.beginRun(BEGIN)).resolves.toEqual({ id: "r-1", attempts: 1, payload: { a: 1 } })

            expect(em.query).toHaveBeenCalledWith(INSERT_RUN, [
                "p-1",
                "ws-1",
                "t-1",
                "d-1",
                '{"a":1}',
                "running",
                1,
                NOW,
            ])
        })

        it("stores a trigger for later queued and answers none", async () => {
            const em = mockEntityManager({ query: [INSERT_RUN, [{ id: "r-1", attempts: 0 }]] })
            const { runs } = await build(em)
            const runAt = new Date("2026-10-12T11:00:00.000Z")

            await expect(runs.beginRun({ ...BEGIN, runAt })).resolves.toBeNull()

            expect(em.query).toHaveBeenCalledWith(INSERT_RUN, [
                "p-1",
                "ws-1",
                "t-1",
                "d-1",
                '{"a":1}',
                "queued",
                0,
                runAt.toISOString(),
            ])
        })

        it("runs a trigger scheduled within the second at once", async () => {
            const em = mockEntityManager({ query: [INSERT_RUN, [{ id: "r-1", attempts: 1 }]] })
            const { runs } = await build(em)

            await expect(runs.beginRun({ ...BEGIN, runAt: new Date(NOW) })).resolves.toMatchObject({ id: "r-1" })
        })

        it("answers none for a repeated trigger", async () => {
            const em = mockEntityManager({ query: [INSERT_RUN, []] })
            const { runs } = await build(em)

            await expect(runs.beginRun(BEGIN)).resolves.toBeNull()
        })
    })

    describe("dueRunIds", () => {
        it("answers the ids of the runs that are due", async () => {
            const em = mockEntityManager({ query: [SELECT_DUE_RUNS, [{ id: "r-1" }, { id: "r-2" }]] })
            const { runs } = await build(em)

            await expect(runs.dueRunIds("p-1", new Date(NOW), 10)).resolves.toEqual(["r-1", "r-2"])

            expect(em.query).toHaveBeenCalledWith(SELECT_DUE_RUNS, ["p-1", 3, NOW, 10])
        })
    })

    describe("claimRun", () => {
        it("answers the claimed run, or none when another tick took it", async () => {
            const claimed: ClaimedRun = { id: "r-1", attempts: 2, payload: {} }
            const { runs } = await build(mockEntityManager({ query: [CLAIM_RUN, [claimed]] }))
            const { runs: lost } = await build(mockEntityManager({ query: [CLAIM_RUN, []] }))

            await expect(runs.claimRun("r-1")).resolves.toEqual(claimed)
            await expect(lost.claimRun("r-1")).resolves.toBeNull()
        })
    })

    describe("executeRun", () => {
        const run: ClaimedRun = { id: "r-1", attempts: 1, payload: {} }

        it("finishes the run with the result of the execution", async () => {
            const em = mockEntityManager({ query: [FINISH_RUN, []] })
            const { runs } = await build(em)

            await expect(
                runs.executeRun(run, () => Promise.resolve({ status: "done", steps: [], evidence: "why" })),
            ).resolves.toBe("done")

            expect(em.query).toHaveBeenCalledWith(FINISH_RUN, ["r-1", "done", "[]", "why", NOW])
        })

        it("keeps a run that waits for approval unfinished", async () => {
            const em = mockEntityManager({ query: [FINISH_RUN, []] })
            const { runs } = await build(em)

            await runs.executeRun(run, () => Promise.resolve({ status: "waiting_approval", steps: [] }))

            expect(em.query).toHaveBeenCalledWith(FINISH_RUN, ["r-1", "waiting_approval", "[]", null, null])
        })

        it("stores a failure with the first backoff and a retry while attempts are left", async () => {
            const em = mockEntityManager({ query: [FAIL_RUN, []] })
            const { runs, logger } = await build(em)

            await expect(runs.executeRun(run, () => Promise.reject(new Error("boom")))).resolves.toBe("failed")

            expect(logger.error).toHaveBeenCalledWith(AutomationRunsLogEvent.RunFailed, expect.any(Error), {
                runId: "r-1",
                attempt: 1,
            })
            expect(em.query).toHaveBeenCalledWith(FAIL_RUN, [
                "r-1",
                "boom",
                "2026-10-12T10:02:00.000Z",
                null,
                JSON.stringify([{ label: "Loi", status: "failed", detail: "boom" }]),
            ])
        })

        it("ends a run on its third failure, whatever was thrown", async () => {
            const em = mockEntityManager({ query: [FAIL_RUN, []] })
            const { runs } = await build(em)

            await runs.executeRun({ ...run, attempts: 3 }, () => Promise.reject("plain"))

            expect(em.query).toHaveBeenCalledWith(FAIL_RUN, [
                "r-1",
                "plain",
                "2026-10-12T10:30:00.000Z",
                NOW,
                expect.any(String),
            ])
        })

        it("waits ten minutes after the second failure", async () => {
            const em = mockEntityManager({ query: [FAIL_RUN, []] })
            const { runs } = await build(em)

            await runs.executeRun({ ...run, attempts: 2 }, () => Promise.reject(new Error("again")))

            expect(em.query).toHaveBeenCalledWith(FAIL_RUN, [
                "r-1",
                "again",
                "2026-10-12T10:10:00.000Z",
                null,
                expect.any(String),
            ])
        })
    })

    describe("finishRun and settleRun", () => {
        it("ends a run without evidence", async () => {
            const em = mockEntityManager({ query: [FINISH_RUN, []] })
            const { runs } = await build(em)

            await runs.finishRun("r-1", { status: "skipped", steps: [] })

            expect(em.query).toHaveBeenCalledWith(FINISH_RUN, ["r-1", "skipped", "[]", null, NOW])
        })

        it("ends a run the owner decided", async () => {
            const em = mockEntityManager({ query: [FINISH_RUN, []] })
            const { runs } = await build(em)

            await runs.settleRun({ runId: "r-1", status: "done", steps: [], evidence: "approved" })

            expect(em.query).toHaveBeenCalledWith(FINISH_RUN, ["r-1", "done", "[]", "approved", NOW])
        })
    })

    describe("runsOf", () => {
        it("reads the latest runs of a workspace", async () => {
            const em = mockEntityManager({ query: [SELECT_RUNS, [{ id: "r-1" }]] })
            const { runs } = await build(em)

            await expect(runs.runsOf({ workspaceId: "ws-1", templateKey: null, limit: 20 })).resolves.toEqual([
                { id: "r-1" },
            ])

            expect(em.query).toHaveBeenCalledWith(SELECT_RUNS, ["ws-1", null, 20])
        })
    })

    describe("priorRuns", () => {
        it("reads nothing for no reference", async () => {
            const em = mockEntityManager()
            const { runs } = await build(em)

            await expect(runs.priorRuns("p-1", [])).resolves.toEqual([])

            expect(em.query).not.toHaveBeenCalled()
        })

        it("reads the history of the references", async () => {
            const em = mockEntityManager({ query: [SELECT_PRIOR_RUNS, [{ trigger_ref: "a" }]] })
            const { runs } = await build(em)

            await expect(runs.priorRuns("p-1", ["a"])).resolves.toEqual([{ trigger_ref: "a" }])

            expect(em.query).toHaveBeenCalledWith(SELECT_PRIOR_RUNS, ["p-1", ["a"]])
        })
    })

    describe("waitingRunsFor", () => {
        it("reads the runs that wait for one work item", async () => {
            const em = mockEntityManager({ query: [SELECT_WAITING_RUNS, [{ id: "r-1" }]] })
            const { runs } = await build(em)

            await expect(runs.waitingRunsFor("ws-1", "w-1")).resolves.toEqual([{ id: "r-1" }])

            expect(em.query).toHaveBeenCalledWith(SELECT_WAITING_RUNS, ["ws-1", '[{"workItemId":"w-1"}]'])
        })
    })

    describe("latestDoneRun", () => {
        it("answers the latest finished run, or none", async () => {
            const query = { pipelineId: "p-1", reference: "ref", since: NOW }
            const { runs } = await build(
                mockEntityManager({ query: [SELECT_LATEST_DONE_RUN, [{ id: "r-1", payload: { x: 1 } }]] }),
            )
            const { runs: none } = await build(mockEntityManager({ query: [SELECT_LATEST_DONE_RUN, []] }))

            await expect(runs.latestDoneRun(query)).resolves.toEqual({ id: "r-1", attempts: 0, payload: { x: 1 } })
            await expect(none.latestDoneRun(query)).resolves.toBeNull()
        })
    })

    describe("markPayload", () => {
        it("replaces the payload of a run", async () => {
            const em = mockEntityManager({ query: [UPDATE_RUN_PAYLOAD, []] })
            const { runs } = await build(em)

            await runs.markPayload("r-1", { y: 2 })

            expect(em.query).toHaveBeenCalledWith(UPDATE_RUN_PAYLOAD, ["r-1", '{"y":2}'])
        })
    })
})
