import { FakeClock, mock } from "@starci/jest-preset"
import { AutomationPipelinesService } from "@modules/domain/automation-pipelines"
import type { PipelineRow } from "@modules/domain/automation-pipelines"
import { AutomationRunsService } from "@modules/domain/automation-runs"
import { AutomationTemplatesService } from "@modules/domain/automation-templates"
import type { TemplateDefinition } from "@modules/domain/automation-templates"
import { N8nDataService, N8nRunsService } from "@modules/domain/n8n-runs"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { Logger } from "@modules/platform/logging"
import { AutomationCareExecutorsService } from "./automation-care-executors.service"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationExtensionsService } from "./automation-extensions.service"
import { AutomationOperationsExecutorsService } from "./automation-operations-executors.service"
import type { AutomationOffice } from "./automation-ports.contracts"
import { AutomationScansService } from "./automation-scans.service"
import { AutomationShopService } from "./automation-shop.service"
import { buildPipelineRow, buildShop, buildTemplate } from "@tests/fixtures/builders/automations.builder"
import { AutomationsLogEvent } from "./automations.log-events"

const NOW = "2026-10-12T10:00:00.000Z"
const DONE = { status: "done" as const, steps: [] }

interface Setup {
    readonly pipelines: ReadonlyArray<PipelineRow>
    readonly templates: ReadonlyArray<TemplateDefinition>
}

const build = ({ pipelines, templates }: Setup) => {
    const clock = new FakeClock(NOW)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}${JSON.stringify(params)}`)
    const logger = mock<Logger>()
    const office = mock<AutomationOffice>()
    const templateService = mock<AutomationTemplatesService>()
    templateService.listTemplates.mockResolvedValue(templates)
    const pipelineService = mock<AutomationPipelinesService>()
    pipelineService.enabledPipelines.mockResolvedValue(pipelines)
    pipelineService.enabledPipelinesOf.mockResolvedValue(pipelines)
    const runs = mock<AutomationRunsService>()
    runs.dueRunIds.mockResolvedValue([])
    runs.waitingRunsFor.mockResolvedValue([])
    const shop = mock<AutomationShopService>()
    shop.shopOf.mockResolvedValue(buildShop())
    const scans = mock<AutomationScansService>()
    scans.planScan.mockResolvedValue({ runs: [], events: [] })
    const care = mock<AutomationCareExecutorsService>()
    care.executors.mockReturnValue({})
    const operations = mock<AutomationOperationsExecutorsService>()
    operations.executors.mockReturnValue({})
    const extensions = mock<AutomationExtensionsService>()
    extensions.tick.mockResolvedValue(0)
    extensions.scan.mockResolvedValue(null)
    const n8nRuns = mock<N8nRunsService>()
    const n8nData = mock<N8nDataService>()
    const engine = new AutomationEngineService(
        clock,
        catalog,
        logger,
        office,
        templateService,
        pipelineService,
        runs,
        shop,
        scans,
        care,
        operations,
        extensions,
        n8nRuns,
        n8nData,
    )
    return {
        engine,
        clock,
        logger,
        office,
        pipelineService,
        runs,
        shop,
        scans,
        care,
        operations,
        extensions,
        n8nRuns,
        n8nData,
    }
}

const template = (key: string, overrides: Partial<TemplateDefinition> = {}) => buildTemplate({ key, ...overrides })
const pipeline = (key: string, overrides: Partial<PipelineRow> = {}) =>
    buildPipelineRow({ id: `p-${key}`, template_key: key, ...overrides })

describe("AutomationEngineService ticks", () => {
    describe("runTick", () => {
        const now = new Date(NOW)

        it("executes the runs that are due and counts them", async () => {
            const { engine, care, runs, extensions } = build({
                pipelines: [pipeline("thank_payment"), pipeline("ask_review")],
                templates: [template("thank_payment"), template("ask_review")],
            })
            care.executors.mockReturnValue({ thank_payment: jest.fn().mockResolvedValue(DONE) })
            runs.dueRunIds.mockResolvedValue(["r-1", "r-2"])
            runs.claimRun.mockResolvedValueOnce({ id: "r-1", attempts: 2, payload: {} })
            runs.claimRun.mockResolvedValueOnce(null)
            runs.executeRun.mockResolvedValue("done")
            extensions.tick.mockResolvedValue(4)

            await expect(engine.runTick(now)).resolves.toEqual({ pipelines: 2, runs: 5 })

            expect(runs.dueRunIds).toHaveBeenCalledTimes(1)
            expect(runs.dueRunIds).toHaveBeenCalledWith("p-thank_payment", now, 8)
            expect(runs.executeRun).toHaveBeenCalledTimes(1)
        })

        it("starts what the scan of an extension or of the engine plans", async () => {
            const { engine, care, extensions, scans, runs } = build({
                pipelines: [pipeline("debt_reminder"), pipeline("contract_renewal")],
                templates: [template("debt_reminder"), template("contract_renewal")],
            })
            care.executors.mockReturnValue({ debt_reminder: jest.fn() })
            extensions.scan.mockResolvedValueOnce(null).mockResolvedValueOnce(2)
            scans.planScan.mockResolvedValue({
                runs: [{ dedupe: "debt:i-1:1", triggerRef: "i-1", payload: { a: 1 } }],
                events: [{ dedupe: "contract.expiring:c-1:2026-10-20", data: { contract_id: "c-1" } }],
            })
            runs.beginRun.mockResolvedValue(null)

            await expect(engine.runTick(now)).resolves.toEqual({ pipelines: 2, runs: 2 + 2 })

            expect(scans.planScan).toHaveBeenCalledTimes(1)
            expect(runs.beginRun).toHaveBeenCalledWith(
                expect.objectContaining({ dedupe: "debt:i-1:1", triggerRef: "i-1", runAt: undefined }),
            )
        })

        it("lets an extension start a run through the scan context", async () => {
            const { engine, care, extensions, runs } = build({
                pipelines: [pipeline("debt_reminder")],
                templates: [template("debt_reminder")],
            })
            care.executors.mockReturnValue({ debt_reminder: jest.fn() })
            runs.beginRun.mockResolvedValue(null)
            extensions.scan.mockImplementation(async (context) => {
                await context.trigger("d-1", "t-1", { a: 1 })
                return 1
            })

            await engine.runTick(now)

            expect(runs.beginRun).toHaveBeenCalledWith(expect.objectContaining({ dedupe: "d-1", triggerRef: "t-1" }))
        })

        it("logs a failing scan and goes on", async () => {
            const { engine, scans, logger } = build({
                pipelines: [pipeline("debt_reminder")],
                templates: [template("debt_reminder")],
            })
            const failure = new Error("scan failed")
            scans.planScan.mockRejectedValue(failure)

            await expect(engine.runTick(now)).resolves.toEqual({ pipelines: 1, runs: 0 })

            expect(logger.error).toHaveBeenCalledWith(AutomationsLogEvent.ScanFailed, failure, {
                template: "debt_reminder",
            })
        })

        it("reads the shop of a workspace once and stops when the time budget is spent", async () => {
            const { engine, clock, runs, shop, scans, care } = build({
                pipelines: [pipeline("thank_payment"), pipeline("ask_review", { id: "p-2" })],
                templates: [template("thank_payment"), template("ask_review")],
            })
            care.executors.mockReturnValue({ thank_payment: jest.fn(), ask_review: jest.fn() })
            runs.dueRunIds.mockImplementation(() => {
                clock.advance(30_000)
                return Promise.resolve([])
            })

            await expect(engine.runTick(now)).resolves.toEqual({ pipelines: 2, runs: 0 })

            expect(runs.dueRunIds).toHaveBeenCalledTimes(1)
            expect(shop.shopOf).toHaveBeenCalledTimes(1)
            expect(scans.planScan).not.toHaveBeenCalled()
        })

        it("reuses the shop of a workspace across the pipelines of a tick", async () => {
            const { engine, shop } = build({
                pipelines: [pipeline("thank_payment"), pipeline("ask_review")],
                templates: [template("thank_payment"), template("ask_review")],
            })

            await engine.runTick(now)

            expect(shop.shopOf).toHaveBeenCalledTimes(1)
        })

        describe("the scheduled n8n workflows", () => {
            const scheduled = (time = "17:00"): Setup => ({
                pipelines: [pipeline("email-daily-report", { config: { time } })],
                templates: [
                    template("email-daily-report", {
                        executor: "n8n",
                        settings: [{ key: "time", kind: "time", label: { vi: "a", en: "b" } }],
                        defaults: { time: "17:00" },
                        trigger: { kind: "schedule", event: "schedule.daily", line: { vi: "a", en: "b" } },
                        n8n: { webhook: "nivo/daily", audience: "owner" },
                    }),
                ],
            })

            it("starts the run that is due and counts it", async () => {
                const { engine, n8nRuns } = build(scheduled())
                n8nRuns.startRun.mockResolvedValue("run-1")

                await expect(engine.runTick(now)).resolves.toEqual({ pipelines: 0, runs: 1 })

                expect(n8nRuns.startRun).toHaveBeenCalledWith(
                    expect.objectContaining({
                        templateKey: "email-daily-report",
                        webhookPath: "nivo/daily",
                        data: { date: "2026-10-12" },
                        dedupe: "day:2026-10-12",
                    }),
                )
            })

            it("counts nothing for a run that was already started, a workflow that is not due and one that is not scheduled", async () => {
                const started = build(scheduled())
                started.n8nRuns.startRun.mockResolvedValue(null)
                const notDue = build(scheduled("23:00"))
                const notScheduled = build({
                    pipelines: [pipeline("email-payment-receipt")],
                    templates: [template("email-payment-receipt", { executor: "n8n" })],
                })

                await expect(started.engine.runTick(now)).resolves.toEqual({ pipelines: 0, runs: 0 })
                await expect(notDue.engine.runTick(now)).resolves.toEqual({ pipelines: 0, runs: 0 })
                await notScheduled.engine.runTick(now)

                expect(notDue.n8nRuns.startRun).not.toHaveBeenCalled()
                expect(notScheduled.n8nRuns.startRun).not.toHaveBeenCalled()
            })

            it("logs a workflow that cannot be started", async () => {
                const { engine, n8nRuns, logger } = build(scheduled())
                const failure = new Error("no base")
                n8nRuns.startRun.mockRejectedValue(failure)

                await engine.runTick(now)

                expect(logger.error).toHaveBeenCalledWith(AutomationsLogEvent.ScanFailed, failure, {
                    template: "email-daily-report",
                })
            })
        })
    })

    describe("tickNow", () => {
        it("runs the tick at the current instant", async () => {
            const { engine, pipelineService } = build({ pipelines: [], templates: [] })

            await expect(engine.tickNow()).resolves.toEqual({ pipelines: 0, runs: 0 })

            expect(pipelineService.enabledPipelines).toHaveBeenCalledTimes(2)
        })
    })
})
