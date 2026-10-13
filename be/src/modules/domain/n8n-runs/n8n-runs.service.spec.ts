import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { N8N_CLIENT, N8nError, N8nErrorCode } from "@modules/integrations/n8n"
import type { N8nClient } from "@modules/integrations/n8n"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { N8nQueue } from "@modules/queues/n8n"
import { N8nRunsErrorCode } from "./errors/n8n-runs.error"
import type { N8nRunContext, StartN8nRun } from "./n8n-runs.contracts"
import { N8nRunsLogEvent } from "./n8n-runs.log-events"
import { N8nRunsService } from "./n8n-runs.service"
import {
    COMPLETE_N8N_RUN,
    INSERT_N8N_RUN,
    SELECT_API_BASE,
    SELECT_N8N_RUN,
    SELECT_RUN_PIPELINE,
} from "./persistence/n8n-runs.sql"
import { hashToken } from "./policies/n8n-run.policy"

const NOW = "2026-10-12T10:00:00.000Z"
const RUN_ID = "11111111-2222-4333-8444-555555555555"
const TOKEN = `${RUN_ID}.secret`
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
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: N8N_CLIENT, useValue: n8n },
            { provide: N8nQueue, useValue: queue },
        ],
    }).compile()
    return { runs: moduleRef.get(N8nRunsService), n8n, queue, logger }
}

describe("N8nRunsService", () => {
    describe("startRun", () => {
        it("writes the run and its delivery job in one transaction and answers the run id", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [SELECT_API_BASE, [{ value: "https://api.example" }]],
                        [INSERT_N8N_RUN, [{ id: RUN_ID, token: TOKEN }]],
                    ],
                }),
            )
            const { runs, queue } = await build(tx.em)

            await expect(runs.startRun(START)).resolves.toBe(RUN_ID)

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_N8N_RUN, [
                "ws-1",
                "email-daily-report",
                "day-1",
                new Date("2026-10-12T10:30:00.000Z"),
            ])
            expect(queue.enqueueEmit).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    runId: RUN_ID,
                    event: "pipeline.email-daily-report",
                    urls: [],
                    paths: ["nivo/email-daily-report"],
                    data: {
                        run_id: RUN_ID,
                        run_token: TOKEN,
                        api_base: "https://api.example",
                        template_key: "email-daily-report",
                        config: { time: "08:00" },
                        data: { date: "2026-10-12" },
                    },
                },
                expect.anything(),
            )
        })

        it("answers none for an occurrence that already started a run", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [SELECT_API_BASE, [{ value: "https://api.example" }]],
                        [INSERT_N8N_RUN, []],
                    ],
                }),
            )
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
            const { runs } = await build(mockEntityManager({ query: [SELECT_API_BASE, []] }))

            await expect(runs.startRun(START)).rejects.toMatchObject({ code: N8nRunsErrorCode.ApiBaseMissing })
        })
    })

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
            const em = mockEntityManager({ query: [COMPLETE_N8N_RUN, [{ id: RUN_ID }]] })
            const { runs, n8n, logger } = await build(em)
            n8n.deliver.mockRejectedValue(new N8nError({ code: N8nErrorCode.TargetRefused }))

            await runs.deliver(PAYLOAD)

            expect(logger.warn).toHaveBeenCalledWith(N8nRunsLogEvent.DeliveryRefused, {
                runId: RUN_ID,
                code: N8nErrorCode.TargetRefused,
            })
            expect(em.query).toHaveBeenCalledWith(COMPLETE_N8N_RUN, [RUN_ID, "ws-1", "failed", "Bi tu choi", null])
        })
    })

    describe("verifyRun", () => {
        const stored = (overrides: Record<string, unknown> = {}) => ({
            id: RUN_ID,
            workspace_id: "ws-1",
            template_key: "email-daily-report",
            token_hash: hashToken(TOKEN),
            expires_at: "2026-10-12T10:20:00.000Z",
            status: "running",
            ...overrides,
        })

        it("answers the context of the run with its settings and wording", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_N8N_RUN, [stored()]],
                    [SELECT_RUN_PIPELINE, [{ config: { time: "08:00" }, body: "Hello" }]],
                ],
            })
            const { runs } = await build(em)

            await expect(runs.verifyRun({ authorization: `Bearer ${TOKEN}`, expectedRunId: RUN_ID })).resolves.toEqual({
                runId: RUN_ID,
                workspaceId: "ws-1",
                templateKey: "email-daily-report",
                config: { time: "08:00", body: "Hello" },
            })
        })

        it("answers the settings alone when the pipeline has no wording or does not exist", async () => {
            const { runs } = await build(
                mockEntityManager({
                    query: [
                        [SELECT_N8N_RUN, [stored()]],
                        [SELECT_RUN_PIPELINE, [{ config: { a: 1 }, body: null }]],
                    ],
                }),
            )
            const { runs: bare } = await build(
                mockEntityManager({
                    query: [
                        [SELECT_N8N_RUN, [stored()]],
                        [SELECT_RUN_PIPELINE, []],
                    ],
                }),
            )

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

        it.each([
            ["an unknown run", []],
            ["a wrong token", [stored({ token_hash: hashToken("other") })]],
            ["an expired token", [stored({ expires_at: "2026-10-12T09:59:59.000Z" })]],
            ["a finished run", [stored({ status: "done" })]],
        ])("answers none for %s", async (_name, rows) => {
            const { runs } = await build(mockEntityManager({ query: [SELECT_N8N_RUN, rows] }))

            await expect(
                runs.verifyRun({ authorization: `Bearer ${TOKEN}`, expectedRunId: undefined }),
            ).resolves.toBeNull()
        })
    })

    describe("completeRun", () => {
        const run: N8nRunContext = { runId: RUN_ID, workspaceId: "ws-1", templateKey: "email-daily-report", config: {} }

        it("closes the run with the status, the summary and the result n8n reported", async () => {
            const em = mockEntityManager({ query: [COMPLETE_N8N_RUN, [{ id: RUN_ID }]] })
            const { runs } = await build(em)

            await runs.completeRun(run, { status: "failed", summary: "oops", result: { n: 1 } })

            expect(em.query).toHaveBeenCalledWith(COMPLETE_N8N_RUN, [RUN_ID, "ws-1", "failed", "oops", '{"n":1}'])
        })

        it("words the counters when no summary came, and knows an unnamed counter by its key", async () => {
            const em = mockEntityManager({ query: [COMPLETE_N8N_RUN, [{ id: RUN_ID }]] })
            const { runs } = await build(em)

            await runs.completeRun(run, { result: { counts: { sent: 2, other: 1 } } })

            expect(em.query).toHaveBeenCalledWith(COMPLETE_N8N_RUN, [
                RUN_ID,
                "ws-1",
                "done",
                "Da gui: 2 · other: 1",
                '{"counts":{"sent":2,"other":1}}',
            ])
        })

        it("fails when the run cannot be closed", async () => {
            const { runs } = await build(mockEntityManager({ query: [COMPLETE_N8N_RUN, []] }))

            await expect(runs.completeRun(run, {})).rejects.toMatchObject({ code: N8nRunsErrorCode.NotClosed })
        })
    })

    describe("requireWorkflow and requireRun", () => {
        const run: N8nRunContext = { runId: RUN_ID, workspaceId: "ws-1", templateKey: "email-daily-report", config: {} }

        it("answers the run of the expected workflow and refuses any other", async () => {
            const { runs } = await build(mockEntityManager())

            expect(runs.requireWorkflow(run, "email-daily-report")).toBe(run)
            expect(() => runs.requireWorkflow(run, "email-debt-reminder")).toThrow(
                expect.objectContaining({ code: N8nRunsErrorCode.WorkflowMismatch }),
            )
            expect(() => runs.requireWorkflow(null, "email-daily-report")).toThrow(
                expect.objectContaining({ code: N8nRunsErrorCode.WorkflowMismatch }),
            )
        })

        it("answers the proved run and refuses none", async () => {
            const { runs } = await build(mockEntityManager())

            expect(runs.requireRun(run)).toBe(run)
            expect(() => runs.requireRun(null)).toThrow(
                expect.objectContaining({ code: N8nRunsErrorCode.RunUnauthorized }),
            )
        })
    })
})
