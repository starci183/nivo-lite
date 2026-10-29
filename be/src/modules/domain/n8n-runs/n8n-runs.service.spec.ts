import { Test } from "@nestjs/testing"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { FakeClock, fakeIds, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
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
        ],
    }).compile()
    return { runs: moduleRef.get(N8nRunsService), n8n, queue, logger }
}

/** What the pipeline query answers: the settings and the wording of the run's template. */
interface PipelineAnswer {
    readonly config: Record<string, unknown>
    readonly body: string | null
}

describe("N8nRunsService", () => {
    describe("startRun", () => {
        it("writes the run and its delivery job in one transaction and answers the run id", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    findOne: [N8nPlatformConfigEntity, { key: "api_base", value: "https://api.example" }],
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
                    findOne: [N8nPlatformConfigEntity, { key: "api_base", value: "https://api.example" }],
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
})

describe("N8nRunsService", () => {
    describe("deliver", () => {
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
            expect(em.update).toHaveBeenCalledWith(
                N8nRunEntity,
                { id: RUN_ID, workspaceId: "ws-1" },
                { status: "failed", summary: "Bi tu choi", result: null, finishedAt: anything() },
            )
        })
    })
})

describe("N8nRunsService", () => {
    describe("verifyRun", () => {
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
            answerQueryBuilders(
                em,
                fakeQueryBuilder({ getRawOne: { config: { time: "08:00" }, body: "Hello" } satisfies PipelineAnswer }),
            )
            const { runs } = await build(em)

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
            answerQueryBuilders(
                withBody,
                fakeQueryBuilder({ getRawOne: { config: { a: 1 }, body: null } satisfies PipelineAnswer }),
            )
            answerQueryBuilders(without, fakeQueryBuilder({ getRawOne: undefined }))
            const { runs } = await build(withBody)
            const { runs: bare } = await build(without)

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
})

describe("N8nRunsService", () => {
    describe("verifyRun", () => {
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

            await expect(
                runs.verifyRun({ authorization: `Bearer ${TOKEN}`, expectedRunId: undefined }),
            ).resolves.toBeNull()
        })
    })

    describe("completeRun", () => {
        const run: N8nRunContext = { runId: RUN_ID, workspaceId: "ws-1", templateKey: "email-daily-report", config: {} }

        it("closes the run with the status, the summary and the result n8n reported", async () => {
            const em = mockEntityManager({ update: [N8nRunEntity, { affected: 1 }] })
            const { runs } = await build(em)

            await runs.completeRun(run, { status: "failed", summary: "oops", result: { n: 1 } })

            expect(em.update).toHaveBeenCalledWith(
                N8nRunEntity,
                { id: RUN_ID, workspaceId: "ws-1" },
                { status: "failed", summary: "oops", result: { n: 1 }, finishedAt: anything() },
            )
        })

        it("words the counters when no summary came, and knows an unnamed counter by its key", async () => {
            const em = mockEntityManager({ update: [N8nRunEntity, { affected: 1 }] })
            const { runs } = await build(em)

            await runs.completeRun(run, { result: { counts: { sent: 2, other: 1 } } })

            expect(em.update).toHaveBeenCalledWith(
                N8nRunEntity,
                { id: RUN_ID, workspaceId: "ws-1" },
                {
                    status: "done",
                    summary: "Da gui: 2 · other: 1",
                    result: { counts: { sent: 2, other: 1 } },
                    finishedAt: anything(),
                },
            )
        })

        it("fails when the run cannot be closed", async () => {
            const { runs } = await build(mockEntityManager({ update: [N8nRunEntity, { affected: 0 }] }))

            await expect(runs.completeRun(run, {})).rejects.toMatchObject({ code: N8nRunsErrorCode.NotClosed })
        })
    })
})

describe("N8nRunsService", () => {
    describe("requireWorkflow and requireRun", () => {
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
            expect(thrownBy(() => runs.requireRun(null))).toEqual(
                objectLike({ code: N8nRunsErrorCode.RunUnauthorized }),
            )
        })
    })
})
