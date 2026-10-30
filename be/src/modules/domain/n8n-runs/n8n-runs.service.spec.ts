import { Test } from "@nestjs/testing"
import { evaluatedCalls } from "@tests/fixtures/builders/evaluated-calls.builder"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { FakeClock, fakeIds, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AutomationPipelinesService } from "@modules/domain/automation-pipelines"
import type { PipelineRow } from "@modules/domain/automation-pipelines"
import { N8N_CLIENT, N8nError, N8nErrorCode } from "@modules/integrations/n8n"
import type { N8nClient } from "@modules/integrations/n8n"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { N8nQueue } from "@modules/queues/n8n"
import { N8nRunsErrorCode } from "./errors/n8n-runs.error"
import type { N8nRunContext, StartN8nRun } from "./n8n-runs.contracts"
import { N8nRunsLogEvent } from "./n8n-runs.log-events"
import { N8nRunsService } from "./n8n-runs.service"
import { N8nPlatformConfigEntity, N8nRunEntity } from "./persistence/entities"
import { hashToken } from "./policies/n8n-run.policy"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** The match-anything matcher, typed `unknown` so it flows into any slot. */
const anything = (): unknown => expect.anything()

/** The updates the manager was asked for, the database expressions of their values run. */
const updatesOf = (em: MockEntityManager): unknown => evaluatedCalls(em.update.mock.calls, 2)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const NOW = "2026-10-12T10:00:00.000Z"
const RUN_ID = "11111111-2222-4333-8444-555555555555"

/** The criteria of the update that closes the run. */
const CLOSING_RUN = { id: RUN_ID, workspaceId: "ws-1" }
const TOKEN = `${RUN_ID}.secret`
/** The first id of `fakeIds()` is the run, the next two make the secret of its token. */
const STARTED_ID = "00000000-0000-4000-8000-000000000001"
const STARTED_TOKEN = `${STARTED_ID}.00000000000040008000000000000002` + "00000000000040008000000000000003"
const START: StartN8nRun = {
    workspaceId: "ws-1",
    templateKey: "email-daily-report",
    webhookPath: "nivo/email-daily-report",
    config: { time: "08:00" },
    data: { date: "2026-10-12" },
    dedupe: "day-1",
}
const PAYLOAD = {
    workspaceId: "ws-1",
    runId: RUN_ID,
    event: "pipeline.email-daily-report",
    urls: [],
    paths: ["nivo/email-daily-report"],
    data: {},
}

const build = async (em: MockEntityManager) => {
    const pipelines = mock<AutomationPipelinesService>()
    const n8n = mock<N8nClient>()
    const queue = mock<N8nQueue>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key) =>
        key === "automations.n8nCount.sent" ? "Da gui" : key === "automations.n8n.refused" ? "Bi tu choi" : key,
    )
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            N8nRunsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: IDS, useValue: fakeIds() },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: N8N_CLIENT, useValue: n8n },
            { provide: N8nQueue, useValue: queue },
            { provide: AutomationPipelinesService, useValue: pipelines },
        ],
    }).compile()
    return { runs: moduleRef.get(N8nRunsService), n8n, queue, logger, pipelines }
}

/** The pipeline the owner answers: the settings and the wording of the run's template. */
const pipelineOf = (config: PipelineRow["config"], body: string | null): PipelineRow =>
    mock<PipelineRow>({ config, body })

/** The stored api_base setting. */
const API_BASE_ROW: N8nPlatformConfigEntity = {
    key: "api_base",
    value: "https://api.example",
    createdAt: new Date(0),
    updatedAt: new Date(0),
}

describe("N8nRunsService startRun", () => {
    it("writes the run and its delivery job in one transaction and answers the run id", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [N8nPlatformConfigEntity, API_BASE_ROW],
            }),
        )
        const insert = fakeQueryBuilder({ execute: { raw: [{ id: STARTED_ID }] } })
        answerQueryBuilders(tx.em, insert)
        const { runs, queue } = await build(tx.em)

        await expect(runs.startRun(START)).resolves.toBe(STARTED_ID)

        expect(tx.em.createQueryBuilder).toHaveBeenCalledWith(N8nRunEntity, "n")
        expect(insert.argsOf("insert")).toEqual([[]])
        expect(insert.argsOf("values")).toEqual([
            [
                {
                    id: STARTED_ID,
                    workspaceId: "ws-1",
                    templateKey: "email-daily-report",
                    dedupeKey: "day-1",
                    tokenHash: hashToken(STARTED_TOKEN),
                    expiresAt: new Date("2026-10-12T10:30:00.000Z"),
                },
            ],
        ])
        expect(insert.argsOf("orIgnore")).toHaveLength(1)
        expect(queue.enqueueEmit).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                runId: STARTED_ID,
                event: "pipeline.email-daily-report",
                urls: [],
                paths: ["nivo/email-daily-report"],
                data: {
                    run_id: STARTED_ID,
                    run_token: STARTED_TOKEN,
                    api_base: "https://api.example",
                    template_key: "email-daily-report",
                    config: { time: "08:00" },
                    data: { date: "2026-10-12" },
                },
            },
            anything(),
        )
    })

    it("answers none for an occurrence that already started a run", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [N8nPlatformConfigEntity, API_BASE_ROW],
            }),
        )
        answerQueryBuilders(tx.em, fakeQueryBuilder({ execute: { raw: [] } }))
        const { runs, queue } = await build(tx.em)

        await expect(runs.startRun(START)).resolves.toBeNull()

        expect(queue.enqueueEmit).not.toHaveBeenCalled()
    })

    it("refuses a template key that cannot be a workflow", async () => {
        const { runs } = await build(mockEntityManager())

        await expect(runs.startRun({ ...START, templateKey: "Bad Key" })).rejects.toMatchObject({
            code: N8nRunsErrorCode.TemplateKeyInvalid,
        })
    })

    it("refuses to start without a public base url", async () => {
        const { runs } = await build(mockEntityManager({ findOne: [N8nPlatformConfigEntity, null] }))

        await expect(runs.startRun(START)).rejects.toMatchObject({ code: N8nRunsErrorCode.ApiBaseMissing })
    })
})

describe("N8nRunsService deliver", () => {
    it("posts the run to n8n with the instant of the delivery", async () => {
        const { runs, n8n } = await build(mockEntityManager())

        await runs.deliver(PAYLOAD)

        expect(n8n.deliver).toHaveBeenCalledWith({
            deliveryId: RUN_ID,
            workspaceId: "ws-1",
            event: "pipeline.email-daily-report",
            urls: [],
            paths: ["nivo/email-daily-report"],
            data: {},
            occurredAtMs: new Date(NOW).getTime(),
        })
    })

    it("ignores a payload that is not a delivery", async () => {
        const { runs, n8n } = await build(mockEntityManager())

        await runs.deliver({ runId: 3 })

        expect(n8n.deliver).not.toHaveBeenCalled()
    })

    it("rethrows a failure worth another try and an unknown error", async () => {
        const { runs, n8n } = await build(mockEntityManager())
        const transient = new N8nError({ code: N8nErrorCode.DeliveryFailed })
        n8n.deliver.mockRejectedValueOnce(transient).mockRejectedValueOnce(new TypeError("net"))

        await expect(runs.deliver(PAYLOAD)).rejects.toBe(transient)
        await expect(runs.deliver(PAYLOAD)).rejects.toBeInstanceOf(TypeError)
    })

    it("closes the run as failed when n8n refuses it for good", async () => {
        const em = mockEntityManager({ update: [N8nRunEntity, { affected: 1 }] })
        const { runs, n8n, logger } = await build(em)
        n8n.deliver.mockRejectedValue(new N8nError({ code: N8nErrorCode.TargetRefused }))

        await runs.deliver(PAYLOAD)

        expect(logger.warn).toHaveBeenCalledWith(N8nRunsLogEvent.DeliveryRefused, {
            runId: RUN_ID,
            code: N8nErrorCode.TargetRefused,
        })
        expect(updatesOf(em)).toEqual([
            [
                "N8nRunEntity",
                CLOSING_RUN,
                { status: "failed", summary: "Bi tu choi", result: null, finishedAt: "now()" },
            ],
        ])
    })
})

describe("N8nRunsService verifyRun", () => {
    const stored = (overrides: Record<string, unknown> = {}) =>
        Object.assign(new N8nRunEntity(), {
            id: RUN_ID,
            workspaceId: "ws-1",
            templateKey: "email-daily-report",
            tokenHash: hashToken(TOKEN),
            expiresAt: new Date("2026-10-12T10:20:00.000Z"),
            status: "running",
            ...overrides,
        })

    it("answers the context of the run with its settings and wording", async () => {
        const em = mockEntityManager({ findOne: [N8nRunEntity, stored()] })
        const { runs, pipelines } = await build(em)
        pipelines.findPipeline.mockResolvedValue(pipelineOf({ time: "08:00" }, "Hello"))

        await expect(runs.verifyRun({ authorization: `Bearer ${TOKEN}`, expectedRunId: RUN_ID })).resolves.toEqual({
            runId: RUN_ID,
            workspaceId: "ws-1",
            templateKey: "email-daily-report",
            config: { time: "08:00", body: "Hello" },
        })
    })

    it("answers the settings alone when the pipeline has no wording or does not exist", async () => {
        const withBody = mockEntityManager({ findOne: [N8nRunEntity, stored()] })
        const without = mockEntityManager({ findOne: [N8nRunEntity, stored()] })
        const { runs, pipelines: withPipelines } = await build(withBody)
        withPipelines.findPipeline.mockResolvedValue(pipelineOf({ a: 1 }, null))
        const { runs: bare, pipelines: withoutPipelines } = await build(without)
        withoutPipelines.findPipeline.mockResolvedValue(null)

        await expect(
            runs.verifyRun({ authorization: `Bearer ${TOKEN}`, expectedRunId: undefined }),
        ).resolves.toMatchObject({
            config: { a: 1 },
        })
        await expect(
            bare.verifyRun({ authorization: `Bearer ${TOKEN}`, expectedRunId: undefined }),
        ).resolves.toMatchObject({
            config: {},
        })
    })

    it("answers none for a header that is not a bearer token or names another run", async () => {
        const { runs } = await build(mockEntityManager())

        await expect(runs.verifyRun({ authorization: "nope", expectedRunId: undefined })).resolves.toBeNull()
        await expect(
            runs.verifyRun({
                authorization: `Bearer ${TOKEN}`,
                expectedRunId: "99999999-2222-4333-8444-555555555555",
            }),
        ).resolves.toBeNull()
    })
})

describe("N8nRunsService verifyRun refusals", () => {
    const stored = (overrides: Record<string, unknown> = {}) =>
        Object.assign(new N8nRunEntity(), {
            id: RUN_ID,
            workspaceId: "ws-1",
            templateKey: "email-daily-report",
            tokenHash: hashToken(TOKEN),
            expiresAt: new Date("2026-10-12T10:20:00.000Z"),
            status: "running",
            ...overrides,
        })

    it.each([
        ["an unknown run", null],
        ["a wrong token", stored({ tokenHash: hashToken("other") })],
        ["an expired token", stored({ expiresAt: new Date("2026-10-12T09:59:59.000Z") })],
        ["a finished run", stored({ status: "done" })],
    ])("answers none for %s", async (_name, row) => {
        const { runs } = await build(mockEntityManager({ findOne: [N8nRunEntity, row] }))

        await expect(runs.verifyRun({ authorization: `Bearer ${TOKEN}`, expectedRunId: undefined })).resolves.toBeNull()
    })
})

describe("N8nRunsService completeRun", () => {
    const run: N8nRunContext = { runId: RUN_ID, workspaceId: "ws-1", templateKey: "email-daily-report", config: {} }

    it("closes the run with the status, the summary and the result n8n reported", async () => {
        const em = mockEntityManager({ update: [N8nRunEntity, { affected: 1 }] })
        const { runs } = await build(em)

        await runs.completeRun(run, { status: "failed", summary: "oops", result: { n: 1 } })

        expect(updatesOf(em)).toEqual([
            ["N8nRunEntity", CLOSING_RUN, { status: "failed", summary: "oops", result: { n: 1 }, finishedAt: "now()" }],
        ])
    })

    it("words the counters when no summary came, and knows an unnamed counter by its key", async () => {
        const em = mockEntityManager({ update: [N8nRunEntity, { affected: 1 }] })
        const { runs } = await build(em)

        await runs.completeRun(run, { result: { counts: { sent: 2, other: 1 } } })

        expect(updatesOf(em)).toEqual([
            [
                "N8nRunEntity",
                CLOSING_RUN,
                {
                    status: "done",
                    summary: "Da gui: 2 · other: 1",
                    result: { counts: { sent: 2, other: 1 } },
                    finishedAt: "now()",
                },
            ],
        ])
    })

    it("fails when the database does not report how many rows closed", async () => {
        const { runs } = await build(mockEntityManager({ update: [N8nRunEntity, {}] }))

        await expect(runs.completeRun(run, {})).rejects.toMatchObject({ code: N8nRunsErrorCode.NotClosed })
    })

    it("fails when the run cannot be closed", async () => {
        const { runs } = await build(mockEntityManager({ update: [N8nRunEntity, { affected: 0 }] }))

        await expect(runs.completeRun(run, {})).rejects.toMatchObject({ code: N8nRunsErrorCode.NotClosed })
    })

    it("fails when the close reports no affected count at all", async () => {
        const { runs } = await build(mockEntityManager({ update: [N8nRunEntity, {}] }))

        await expect(runs.completeRun(run, {})).rejects.toMatchObject({ code: N8nRunsErrorCode.NotClosed })
    })
})

describe("N8nRunsService requireWorkflow and requireRun", () => {
    const run: N8nRunContext = { runId: RUN_ID, workspaceId: "ws-1", templateKey: "email-daily-report", config: {} }

    it("answers the run of the expected workflow and refuses any other", async () => {
        const { runs } = await build(mockEntityManager())

        expect(runs.requireWorkflow(run, "email-daily-report")).toBe(run)
        expect(thrownBy(() => runs.requireWorkflow(run, "email-debt-reminder"))).toEqual(
            objectLike({ code: N8nRunsErrorCode.WorkflowMismatch }),
        )
        expect(thrownBy(() => runs.requireWorkflow(null, "email-daily-report"))).toEqual(
            objectLike({ code: N8nRunsErrorCode.WorkflowMismatch }),
        )
    })

    it("answers the proved run and refuses none", async () => {
        const { runs } = await build(mockEntityManager())

        expect(runs.requireRun(run)).toBe(run)
        expect(thrownBy(() => runs.requireRun(null))).toEqual(objectLike({ code: N8nRunsErrorCode.RunUnauthorized }))
    })
})
