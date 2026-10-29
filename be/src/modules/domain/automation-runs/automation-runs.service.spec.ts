import { Test } from "@nestjs/testing"
import { AutomationPipelinesService } from "@modules/domain/automation-pipelines"
import { ANY_FUNCTION } from "@tests/fixtures/builders/any-function.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { In, LessThan, LessThanOrEqual, MoreThanOrEqual } from "typeorm"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    doneRunOfTriggerA,
    runCarryingPayloadX,
    runOf,
    runWaitingForApproval,
    secondRun,
} from "@tests/fixtures/builders/automation-runs.builder"
import { AutomationRunsService } from "./automation-runs.service"
import type { ClaimedRun } from "./automation-runs.contracts"
import { AutomationRunsLogEvent } from "./automation-runs.log-events"
import { AutomationRunEntity } from "./persistence/entities"

const NOW = "2026-10-12T10:00:00.000Z"

const build = async (em: MockEntityManager, keys: Array<{ id: string; template_key: string }> = []) => {
    const pipelines = mock<AutomationPipelinesService>()
    pipelines.pipelineKeys.mockResolvedValue(keys)
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
            { provide: AutomationPipelinesService, useValue: pipelines },
        ],
    }).compile()
    return { runs: moduleRef.get(AutomationRunsService), logger }
}

/** A manager whose `createQueryBuilder` answers with a fake builder that resolves `answer`. */
const withBuilder = (answer: unknown) => {
    const em = mockEntityManager()
    const fake = fakeQueryBuilder(Array.isArray(answer) ? { getMany: answer } : { execute: answer })
    em.createQueryBuilder.mockReturnValue(fake.builder)
    return { em, fake }
}

const FINISHED = { error: null, finishedAt: new Date(NOW) }

const BEGIN = {
    pipelineId: "p-1",
    workspaceId: "ws-1",
    dedupe: "d-1",
    triggerRef: "t-1",
    payload: { a: 1 },
    runAt: undefined,
}

describe("AutomationRunsService > beginRun", () => {
    it("stores a running run at once and answers it", async () => {
        const { em, fake } = withBuilder({ raw: [{ id: "r-1", attempts: 1 }] })
        const { runs } = await build(em)

        await expect(runs.beginRun(BEGIN)).resolves.toEqual({ id: "r-1", attempts: 1, payload: { a: 1 } })

        expect(em.createQueryBuilder).toHaveBeenCalledWith(AutomationRunEntity, "ar")
        expect(fake.callsOf("values")).toEqual([
            [
                {
                    pipelineId: "p-1",
                    workspaceId: "ws-1",
                    triggerRef: "t-1",
                    dedupeKey: "d-1",
                    payload: ANY_FUNCTION,
                    status: "running",
                    attempts: 1,
                    runAt: new Date(NOW),
                },
            ],
        ])
        expect(fake.callsOf("setParameter")).toEqual([["payload", '{"a":1}']])
        expect(fake.callsOf("orIgnore")).toHaveLength(1)
        expect(fake.callsOf("returning")).toEqual([[["id", "attempts"]]])
    })

    it("stores a trigger for later queued and answers none", async () => {
        const { em, fake } = withBuilder({ raw: [{ id: "r-1", attempts: 0 }] })
        const { runs } = await build(em)
        const runAt = new Date("2026-10-12T11:00:00.000Z")

        await expect(runs.beginRun({ ...BEGIN, runAt })).resolves.toBeNull()

        expect(fake.callsOf("values")).toEqual([[expect.objectContaining({ status: "queued", attempts: 0, runAt })]])
    })

    it("runs a trigger scheduled within the second at once", async () => {
        const { em } = withBuilder({ raw: [{ id: "r-1", attempts: 1 }] })
        const { runs } = await build(em)

        await expect(runs.beginRun({ ...BEGIN, runAt: new Date(NOW) })).resolves.toMatchObject({ id: "r-1" })
    })

    it("answers none for a repeated trigger", async () => {
        const { em } = withBuilder({ raw: [] })
        const { runs } = await build(em)

        await expect(runs.beginRun(BEGIN)).resolves.toBeNull()
    })
})

describe("AutomationRunsService > dueRunIds", () => {
    it("answers the ids of the runs that are due", async () => {
        const em = mockEntityManager({ find: [AutomationRunEntity, [runOf(), secondRun()]] })
        const { runs } = await build(em)

        await expect(runs.dueRunIds("p-1", new Date(NOW), 10)).resolves.toEqual(["r-1", "r-2"])

        expect(em.find).toHaveBeenCalledWith(AutomationRunEntity, {
            select: { id: true },
            where: {
                pipelineId: "p-1",
                status: In(["queued", "failed"]),
                attempts: LessThan(3),
                runAt: LessThanOrEqual(new Date(NOW)),
            },
            order: { runAt: "ASC" },
            take: 10,
        })
    })
})

describe("AutomationRunsService > claimRun", () => {
    it("answers the claimed run, or none when another tick took it", async () => {
        const claimed: ClaimedRun = { id: "r-1", attempts: 2, payload: {} }
        const { runs } = await build(withBuilder({ raw: [claimed] }).em)
        const { runs: lost } = await build(withBuilder({ raw: [] }).em)

        await expect(runs.claimRun("r-1")).resolves.toEqual(claimed)
        await expect(lost.claimRun("r-1")).resolves.toBeNull()
    })

    it("counts the attempt in the database and treats an answer without a row list as lost", async () => {
        const { em, fake } = withBuilder({ raw: [{ id: "r-1", attempts: 1, payload: {} }] })
        const { runs: counted } = await build(em)
        const { runs: nothing } = await build(withBuilder({ raw: undefined }).em)

        await counted.claimRun("r-1")

        expect(evaluatedValues(fake.callsOf("set")[0]?.[0]).attempts).toBe("attempts + 1")
        await expect(nothing.claimRun("r-1")).resolves.toBeNull()
    })
})

describe("AutomationRunsService > executeRun", () => {
    const run: ClaimedRun = { id: "r-1", attempts: 1, payload: {} }
    it("finishes the run with the result of the execution", async () => {
        const em = mockEntityManager({ update: [AutomationRunEntity, {}] })
        const { runs } = await build(em)

        await expect(
            runs.executeRun(run, () => Promise.resolve({ status: "done", steps: [], evidence: "why" })),
        ).resolves.toBe("done")

        expect(em.update).toHaveBeenCalledWith(
            AutomationRunEntity,
            { id: "r-1" },
            { status: "done", steps: [], evidence: "why", ...FINISHED },
        )
    })

    it("keeps a run that waits for approval unfinished", async () => {
        const em = mockEntityManager({ update: [AutomationRunEntity, {}] })
        const { runs } = await build(em)

        await runs.executeRun(run, () => Promise.resolve({ status: "waiting_approval", steps: [] }))

        expect(em.update).toHaveBeenCalledWith(
            AutomationRunEntity,
            { id: "r-1" },
            { status: "waiting_approval", steps: [], evidence: null, error: null, finishedAt: null },
        )
    })

    it("stores a failure with the first backoff and a retry while attempts are left", async () => {
        const em = mockEntityManager({ update: [AutomationRunEntity, {}] })
        const { runs, logger } = await build(em)

        await expect(runs.executeRun(run, () => Promise.reject(new Error("boom")))).resolves.toBe("failed")

        expect(logger.error).toHaveBeenCalledWith(AutomationRunsLogEvent.RunFailed, expect.any(Error), {
            runId: "r-1",
            attempt: 1,
        })
        expect(em.update).toHaveBeenCalledWith(
            AutomationRunEntity,
            { id: "r-1" },
            {
                status: "failed",
                error: "boom",
                runAt: new Date("2026-10-12T10:02:00.000Z"),
                finishedAt: null,
                steps: [{ label: "Loi", status: "failed", detail: "boom" }],
            },
        )
    })
})

describe("AutomationRunsService > executeRun failures", () => {
    const run: ClaimedRun = { id: "r-1", attempts: 1, payload: {} }
    it("ends a run on its third failure, whatever was thrown", async () => {
        const em = mockEntityManager({ update: [AutomationRunEntity, {}] })
        const { runs } = await build(em)

        await runs.executeRun({ ...run, attempts: 3 }, () => Promise.reject("plain"))

        expect(em.update).toHaveBeenCalledWith(
            AutomationRunEntity,
            { id: "r-1" },
            {
                status: "failed",
                error: "plain",
                runAt: new Date("2026-10-12T10:30:00.000Z"),
                finishedAt: new Date(NOW),
                steps: [{ label: "Loi", status: "failed", detail: "plain" }],
            },
        )
    })

    it("waits ten minutes after the second failure", async () => {
        const em = mockEntityManager({ update: [AutomationRunEntity, {}] })
        const { runs } = await build(em)

        await runs.executeRun({ ...run, attempts: 2 }, () => Promise.reject(new Error("again")))

        expect(em.update).toHaveBeenCalledWith(
            AutomationRunEntity,
            { id: "r-1" },
            {
                status: "failed",
                error: "again",
                runAt: new Date("2026-10-12T10:10:00.000Z"),
                finishedAt: null,
                steps: [{ label: "Loi", status: "failed", detail: "again" }],
            },
        )
    })
})

describe("AutomationRunsService > finishRun and settleRun", () => {
    it("ends a run without evidence", async () => {
        const em = mockEntityManager({ update: [AutomationRunEntity, {}] })
        const { runs } = await build(em)

        await runs.finishRun("r-1", { status: "skipped", steps: [] })

        expect(em.update).toHaveBeenCalledWith(
            AutomationRunEntity,
            { id: "r-1" },
            { status: "skipped", steps: [], evidence: null, ...FINISHED },
        )
    })

    it("ends a run the owner decided", async () => {
        const em = mockEntityManager({ update: [AutomationRunEntity, {}] })
        const { runs } = await build(em)

        await runs.settleRun({ runId: "r-1", status: "done", steps: [], evidence: "approved" })

        expect(em.update).toHaveBeenCalledWith(
            AutomationRunEntity,
            { id: "r-1" },
            { status: "done", steps: [], evidence: "approved", ...FINISHED },
        )
    })
})

describe("AutomationRunsService > runsOf", () => {
    it("reads the latest runs of a workspace", async () => {
        const em = mockEntityManager({ find: [AutomationRunEntity, [runOf()]] })
        const { runs } = await build(em)

        await expect(runs.runsOf({ workspaceId: "ws-1", templateKey: null, limit: 20 })).resolves.toEqual([
            {
                id: "r-1",
                pipeline_id: "p-1",
                trigger_ref: "t-1",
                status: "queued",
                steps: [],
                evidence: null,
                error: null,
                created_at: NOW,
                finished_at: null,
            },
        ])

        expect(em.find).toHaveBeenCalledWith(AutomationRunEntity, {
            where: { workspaceId: "ws-1" },
            order: { createdAt: "DESC" },
            take: 20,
        })
    })

    it("reads the instant a run finished as text", async () => {
        const em = mockEntityManager({ find: [AutomationRunEntity, [runOf({ finishedAt: new Date(NOW) })]] })
        const { runs } = await build(em)

        const [read] = await runs.runsOf({ workspaceId: "ws-1", templateKey: null, limit: 20 })

        expect(read?.finished_at).toBe(NOW)
    })

    it("narrows the runs to the pipelines of one template", async () => {
        const em = mockEntityManager({ find: [AutomationRunEntity, []] })
        const { runs } = await build(em, [
            { id: "p-1", template_key: "thank" },
            { id: "p-2", template_key: "other" },
        ])

        await runs.runsOf({ workspaceId: "ws-1", templateKey: "thank", limit: 5 })

        expect(em.find).toHaveBeenCalledWith(AutomationRunEntity, {
            where: { workspaceId: "ws-1", pipelineId: In(["p-1"]) },
            order: { createdAt: "DESC" },
            take: 5,
        })
    })

    it("reads nothing when the workspace has no pipeline of the template", async () => {
        const em = mockEntityManager()
        const { runs } = await build(em, [{ id: "p-2", template_key: "other" }])

        await expect(runs.runsOf({ workspaceId: "ws-1", templateKey: "thank", limit: 5 })).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("AutomationRunsService > priorRuns", () => {
    it("reads nothing for no reference", async () => {
        const em = mockEntityManager()
        const { runs } = await build(em)

        await expect(runs.priorRuns("p-1", [])).resolves.toEqual([])

        expect(em.find).not.toHaveBeenCalled()
    })

    it("reads the history of the references", async () => {
        const em = mockEntityManager({ find: [AutomationRunEntity, [doneRunOfTriggerA()]] })
        const { runs } = await build(em)

        await expect(runs.priorRuns("p-1", ["a"])).resolves.toEqual([
            { trigger_ref: "a", status: "done", created_at: NOW, dedupe_key: "d-1" },
        ])

        expect(em.find).toHaveBeenCalledWith(AutomationRunEntity, {
            select: { triggerRef: true, status: true, createdAt: true, dedupeKey: true },
            where: { pipelineId: "p-1", triggerRef: In(["a"]) },
            take: 5000,
        })
    })
})

describe("AutomationRunsService > waitingRunsFor", () => {
    it("reads the runs that wait for one work item", async () => {
        const { em, fake } = withBuilder([runWaitingForApproval()])
        const { runs } = await build(em)

        await expect(runs.waitingRunsFor("ws-1", "w-1")).resolves.toEqual([
            { id: "r-1", pipeline_id: "p-1", steps: [] },
        ])

        expect(fake.callsOf("andWhere")).toEqual([
            ["r.status = :status", { status: "waiting_approval" }],
            ["r.steps @> CAST(:fragment AS jsonb)", { fragment: '[{"workItemId":"w-1"}]' }],
        ])
        expect(fake.callsOf("limit")).toEqual([[50]])
    })
})

describe("AutomationRunsService > latestDoneRun", () => {
    it("answers the latest finished run, or none", async () => {
        const query = { pipelineId: "p-1", reference: "ref", since: NOW }
        const em = mockEntityManager({ findOne: [AutomationRunEntity, runCarryingPayloadX()] })
        const { runs } = await build(em)
        const { runs: none } = await build(mockEntityManager({ findOne: [AutomationRunEntity, null] }))

        await expect(runs.latestDoneRun(query)).resolves.toEqual({ id: "r-1", attempts: 0, payload: { x: 1 } })
        await expect(none.latestDoneRun(query)).resolves.toBeNull()
        expect(em.findOne).toHaveBeenCalledWith(AutomationRunEntity, {
            select: { id: true, payload: true },
            where: {
                pipelineId: "p-1",
                triggerRef: "ref",
                status: "done",
                createdAt: MoreThanOrEqual(new Date(NOW)),
            },
            order: { createdAt: "DESC" },
        })
    })
})

describe("AutomationRunsService > markPayload", () => {
    it("replaces the payload of a run", async () => {
        const { em, fake } = withBuilder({})
        const { runs } = await build(em)

        await runs.markPayload("r-1", { y: 2 })

        expect(fake.callsOf("set")).toEqual([[{ payload: ANY_FUNCTION }]])
        expect(fake.callsOf("where")).toEqual([[{ id: "r-1" }]])
        expect(fake.callsOf("setParameter")).toEqual([["payload", '{"y":2}']])
    })
})
