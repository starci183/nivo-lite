import { Test } from "@nestjs/testing"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG, type MessageCatalog } from "@modules/platform/i18n"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { AUTOMATION_OFFICE } from "./automations.decorators"
import { FakeClock, mock } from "@starci/jest-preset"
import { AutomationPipelinesService, type PipelineRow } from "@modules/domain/automation-pipelines"
import { AutomationRunsService, type ClaimedRun } from "@modules/domain/automation-runs"
import { AutomationTemplatesService, type TemplateDefinition } from "@modules/domain/automation-templates"
import { N8nDataService, N8nRunsService } from "@modules/domain/n8n-runs"
import { AutomationCareExecutorsService } from "./automation-care-executors.service"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationExtensionsService } from "./automation-extensions.service"
import { AutomationOperationsExecutorsService } from "./automation-operations-executors.service"
import type { AutomationOffice, Executor } from "./automation-ports.contracts"
import { AutomationScansService } from "./automation-scans.service"
import { AutomationShopService } from "./automation-shop.service"
import { buildPipelineRow, buildShop, buildTemplate } from "@tests/fixtures/builders/automations.builder"
import { AutomationsLogEvent } from "./automations.log-events"
const NOW = "2026-10-12T10:00:00.000Z"
const DONE = { status: "done" as const, steps: [] }
const build = async ({ pipelines, templates }: ReturnType<typeof setupOf>) => {
    const clock = new FakeClock(NOW)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}${JSON.stringify(params)}`)
    const logger = mock<Logger>()
    const office = mock<AutomationOffice>()
    const templateService = mock<AutomationTemplatesService>({ listTemplates: jest.fn().mockResolvedValue(templates) })
    const pipelineService = mock<AutomationPipelinesService>()
    pipelineService.enabledPipelines.mockResolvedValue(pipelines)
    pipelineService.enabledPipelinesOf.mockResolvedValue(pipelines)
    const runs = mock<AutomationRunsService>()
    runs.dueRunIds.mockResolvedValue([])
    runs.waitingRunsFor.mockResolvedValue([])
    const shop = mock<AutomationShopService>({ shopOf: jest.fn().mockResolvedValue(buildShop()) })
    const scans = mock<AutomationScansService>({ planScan: jest.fn().mockResolvedValue({ runs: [], events: [] }) })
    const care = mock<AutomationCareExecutorsService>({ executors: jest.fn().mockReturnValue({}) })
    const operations = mock<AutomationOperationsExecutorsService>({ executors: jest.fn().mockReturnValue({}) })
    const extensions = mock<AutomationExtensionsService>()
    extensions.tick.mockResolvedValue(0)
    extensions.scan.mockResolvedValue(null)
    const n8nRuns = mock<N8nRunsService>()
    const n8nData = mock<N8nDataService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationEngineService,
            { provide: CLOCK, useValue: clock },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: AUTOMATION_OFFICE, useValue: office },
            { provide: AutomationTemplatesService, useValue: templateService },
            { provide: AutomationPipelinesService, useValue: pipelineService },
            { provide: AutomationRunsService, useValue: runs },
            { provide: AutomationShopService, useValue: shop },
            { provide: AutomationScansService, useValue: scans },
            { provide: AutomationCareExecutorsService, useValue: care },
            { provide: AutomationOperationsExecutorsService, useValue: operations },
            { provide: AutomationExtensionsService, useValue: extensions },
            { provide: N8nRunsService, useValue: n8nRuns },
            { provide: N8nDataService, useValue: n8nData },
        ],
    }).compile()
    const engine = moduleRef.get(AutomationEngineService)
    const services = { logger, office, pipelineService, runs, shop, scans, care, operations }
    return { engine, clock, ...services, extensions, n8nRuns, n8nData }
}
const template = (key: string, overrides: Partial<TemplateDefinition> = {}) => buildTemplate({ key, ...overrides })
const pipeline = (key: string, overrides: Partial<PipelineRow> = {}) =>
    buildPipelineRow({ id: `p-${key}`, template_key: key, ...overrides })
const setupOf = (...keys: ReadonlyArray<string>) => ({
    pipelines: keys.map((key) => pipeline(key)),
    templates: keys.map((key) => template(key)),
})
const n8nSetup = (key: string, definition: Partial<TemplateDefinition> = {}, row: Partial<PipelineRow> = {}) => ({
    pipelines: [pipeline(key, row)],
    templates: [template(key, { executor: "n8n", ...definition })],
})
const expectPartialCall = (call: unknown, fields: object, ...args: ReadonlyArray<unknown>): void => {
    expect(call).toHaveBeenCalledWith(expect.objectContaining(fields), ...args)
}
describe("AutomationEngineService", () => {
    const event = {
        workspaceId: "ws-1",
        event: "payment.received",
        data: { lead_id: "l-1", invoice_id: "i-1" },
        dedupe: "d-1",
    }
    describe("onBusinessEvent", () => {
        const thank = setupOf("thank_payment")
        it("starts the run an event plans for a pipeline that is on, later when the plan says so", async () => {
            const { engine, care, runs } = await build(thank)
            const executor: Executor = jest.fn().mockResolvedValue(DONE)
            care.executors.mockReturnValue({ thank_payment: executor })
            const claimed: ClaimedRun = { id: "r-1", attempts: 1, payload: { x: 1 } }
            runs.beginRun.mockResolvedValue(claimed)
            runs.executeRun.mockImplementation((_run, execution) => execution().then((result) => result.status))
            await engine.onBusinessEvent(event)
            expect(runs.beginRun).toHaveBeenCalledWith({
                pipelineId: "p-thank_payment",
                workspaceId: "ws-1",
                dedupe: "thank:d-1",
                triggerRef: "i-1",
                payload: { lead_id: "l-1", invoice_id: "i-1", at: NOW },
                runAt: new Date("2026-10-12T10:01:30.000Z"),
            })
            expectPartialCall(executor, { workspaceId: "ws-1", body: "" }, claimed.payload)
        })
        it("records a trigger without delay at once, and does not run what was already recorded", async () => {
            const { engine, operations, runs } = await build({
                pipelines: [pipeline("delivery_notice", { body: "Mine" })],
                templates: [template("delivery_notice", { defaultBody: { vi: "Std", en: "Std" } })],
            })
            operations.executors.mockReturnValue({ delivery_notice: jest.fn() })
            runs.beginRun.mockResolvedValue(null)
            await engine.onBusinessEvent({ ...event, event: "order.shipped", data: { order_id: "o-1" } })
            expectPartialCall(runs.beginRun, { runAt: undefined })
            expect(runs.executeRun).not.toHaveBeenCalled()
        })
        it("uses the standard wording of the template when the owner saved none", async () => {
            const { engine, operations, runs } = await build({
                pipelines: [pipeline("delivery_notice")],
                templates: [template("delivery_notice", { defaultBody: { vi: "Std", en: "Std" } })],
            })
            const executor: Executor = jest.fn().mockResolvedValue(DONE)
            operations.executors.mockReturnValue({ delivery_notice: executor })
            runs.beginRun.mockResolvedValue({ id: "r-1", attempts: 1, payload: {} })
            runs.executeRun.mockImplementation((_run, execution) => execution().then((result) => result.status))
            await engine.onBusinessEvent({ ...event, event: "order.shipped", data: { order_id: "o-1" } })
            expectPartialCall(executor, { body: "Std" }, {})
        })
        it("finds an extension's executor and ignores a template nothing executes", async () => {
            const { engine, extensions, runs } = await build(thank)
            extensions.executorOf.mockReturnValue(undefined)
            await engine.onBusinessEvent(event)
            expect(extensions.executorOf).toHaveBeenCalledWith("thank_payment")
            expect(runs.beginRun).not.toHaveBeenCalled()
        })
        it("runs the executor an extension provides", async () => {
            const { engine, extensions, runs } = await build(thank)
            extensions.executorOf.mockReturnValue(jest.fn().mockResolvedValue(DONE))
            runs.beginRun.mockResolvedValue({ id: "r-1", attempts: 1, payload: {} })
            await engine.onBusinessEvent(event)
            expect(runs.executeRun).toHaveBeenCalledTimes(1)
        })
        it("does nothing when no pipeline is on, and leaves the pipelines an event does not start", async () => {
            const none = await build(setupOf())
            const other = await build(thank)
            await none.engine.onBusinessEvent(event)
            await other.engine.onBusinessEvent({ ...event, event: "lead.created" })
            expect(none.shop.shopOf).not.toHaveBeenCalled()
            expect(other.runs.beginRun).not.toHaveBeenCalled()
        })
        it("ignores a pipeline whose template is unknown or run by n8n", async () => {
            const { engine, shop } = await build({
                pipelines: [pipeline("ghost_template"), pipeline("email-daily-report")],
                templates: [template("email-daily-report", { executor: "n8n" })],
            })
            await engine.onBusinessEvent(event)
            expect(shop.shopOf).not.toHaveBeenCalled()
        })
        it("logs a failing pipeline and goes on with the others", async () => {
            const { engine, care, runs, logger } = await build(setupOf("thank_payment", "ask_review"))
            const failure = new Error("boom")
            care.executors.mockReturnValue({ thank_payment: jest.fn(), ask_review: jest.fn() })
            runs.beginRun.mockRejectedValueOnce(failure)
            runs.beginRun.mockResolvedValueOnce(null)
            await engine.onBusinessEvent(event)
            expect(logger.error).toHaveBeenCalledWith(AutomationsLogEvent.EventFailed, failure, {
                template: "thank_payment",
                event: "payment.received",
            })
            expect(runs.beginRun).toHaveBeenCalledTimes(2)
        })
        describe("the payment receipt workflow", () => {
            const receiptSetup = () =>
                n8nSetup(
                    "email-payment-receipt",
                    { n8n: { webhook: "nivo/receipt", audience: "customer" } },
                    { body: "Dear {ten_khach}" },
                )
            it.each([
                ["t-1", "i-1"],
                [null, "i-1"],
                [null, null],
            ] as const)("starts only the receipt for %s/%s", async (transactionId, invoiceId) => {
                const receipt = receiptSetup()
                const { engine, n8nData, n8nRuns, runs, care } = await build({
                    pipelines: [...receipt.pipelines, pipeline("thank_payment")],
                    templates: [...receipt.templates, template("thank_payment")],
                })
                care.executors.mockReturnValue({ thank_payment: jest.fn().mockResolvedValue(DONE) })
                n8nData.paymentReceipt.mockResolvedValue({ dedupe: "receipt:from-data", data: { to: "a@b.c" } })
                await engine.startPaymentReceipt("ws-1", transactionId, invoiceId)
                expect(n8nData.paymentReceipt).toHaveBeenCalledWith("ws-1", transactionId ?? "", invoiceId ?? "")
                expect(n8nRuns.startRun).toHaveBeenCalledWith({
                    workspaceId: "ws-1",
                    templateKey: "email-payment-receipt",
                    webhookPath: "nivo/receipt",
                    config: { body: "Dear {ten_khach}" },
                    data: { to: "a@b.c" },
                    dedupe: "receipt:from-data",
                })
                expect(runs.beginRun).not.toHaveBeenCalled()
            })
            it("starts a run of the shared workflow with the wording and the settings", async () => {
                const { engine, n8nData, n8nRuns } = await build(receiptSetup())
                n8nData.paymentReceipt.mockResolvedValue({ dedupe: "receipt:t-1", data: { to: "a@b.c" } })
                await engine.onBusinessEvent({ ...event, data: { transaction_id: "t-1", invoice_id: "i-1" } })
                expect(n8nData.paymentReceipt).toHaveBeenCalledWith("ws-1", "t-1", "i-1")
                expect(n8nRuns.startRun).toHaveBeenCalledWith({
                    workspaceId: "ws-1",
                    templateKey: "email-payment-receipt",
                    webhookPath: "nivo/receipt",
                    config: { body: "Dear {ten_khach}" },
                    data: { to: "a@b.c" },
                    dedupe: "receipt:t-1",
                })
            })
            it("starts nothing when the payment has no customer address, and logs a failure", async () => {
                const { engine, n8nData, n8nRuns, logger } = await build(receiptSetup())
                n8nData.paymentReceipt.mockResolvedValueOnce(null)
                await engine.onBusinessEvent(event)
                expect(n8nRuns.startRun).not.toHaveBeenCalled()
                const failure = new Error("down")
                n8nData.paymentReceipt.mockRejectedValueOnce(failure)
                await engine.onBusinessEvent(event)
                expect(logger.error).toHaveBeenCalledWith(AutomationsLogEvent.EventFailed, failure, {
                    template: "email-payment-receipt",
                    event: "payment.received",
                })
            })
            it("ignores the workflow for another event or another workflow", async () => {
                const other = await build(n8nSetup("email-daily-report"))
                await other.engine.onBusinessEvent(event)
                await (await build(receiptSetup())).engine.onBusinessEvent({ ...event, event: "lead.created" })
                expect(other.n8nData.paymentReceipt).not.toHaveBeenCalled()
            })
            it("starts the workflow without a settings body when the owner approved none, and by its key when the template names no webhook", async () => {
                const { engine, n8nData, n8nRuns } = await build(
                    n8nSetup("email-payment-receipt", {
                        trigger: { kind: "event", event: "payment.received", line: { vi: "a", en: "b" } },
                    }),
                )
                n8nData.paymentReceipt.mockResolvedValue({ dedupe: "r", data: {} })
                await engine.onBusinessEvent(event)
                expectPartialCall(n8nRuns.startRun, { webhookPath: "email-payment-receipt", config: {} })
            })
        })
        describe("a customer's reply after a review request", () => {
            const reviewSetup = () => setupOf("ask_review")
            const reply = {
                workspaceId: "ws-1",
                event: "message.inbound",
                data: { lead_id: "l-1", text: "bad" },
                dedupe: "d-2",
            }
            it("checks the feedback of the last finished review request of the week", async () => {
                const { engine, runs, care } = await build(reviewSetup())
                runs.latestDoneRun.mockResolvedValue({ id: "r-1", attempts: 0, payload: { lead_id: "l-1" } })
                await engine.onBusinessEvent(reply)
                expect(runs.latestDoneRun).toHaveBeenCalledWith({
                    pipelineId: "p-ask_review",
                    reference: "l-1",
                    since: "2026-10-05T10:00:00.000Z",
                })
                expectPartialCall(care.checkFeedback, {
                    runId: "r-1",
                    runPayload: { lead_id: "l-1" },
                    feedback: "bad",
                    leadId: "l-1",
                })
            })
            it("leaves a request that was already alerted, none that was sent, and a reply with no lead", async () => {
                const { engine, runs, care } = await build(reviewSetup())
                runs.latestDoneRun.mockResolvedValueOnce({
                    id: "r-1",
                    attempts: 0,
                    payload: { alerted: { text: "x" } },
                })
                runs.latestDoneRun.mockResolvedValueOnce(null)
                await engine.onBusinessEvent(reply)
                await engine.onBusinessEvent(reply)
                await engine.onBusinessEvent({ ...reply, data: { text: "bad" } })
                expect(care.checkFeedback).not.toHaveBeenCalled()
                expect(runs.latestDoneRun).toHaveBeenCalledTimes(2)
            })
            it("does nothing when the review automation is off", async () => {
                const { engine, runs } = await build(thank)
                await engine.onBusinessEvent(reply)
                expect(runs.latestDoneRun).not.toHaveBeenCalled()
            })
        })
    })
    describe("a decision of the owner", () => {
        const decision = (data: Record<string, unknown>) => ({ ...event, event: "decision.made", data })
        const waiting = {
            id: "r-1",
            pipeline_id: "p-1",
            steps: [
                { label: "Soan", status: "done" as const },
                { label: "Cho", status: "waiting" as const },
            ],
        }
        it("ends the run that waited and moves the trust ladder", async () => {
            const { engine, runs, pipelineService, office } = await build(setupOf())
            runs.waitingRunsFor.mockResolvedValue([waiting])
            pipelineService.findPipelineById.mockResolvedValue(
                buildPipelineRow({ id: "p-1", name: "Thank", approval_streak: 19 }),
            )
            await engine.onBusinessEvent(decision({ work_item_id: "w-1", outcome: "approved", decided_by: "Lan" }))
            expect(runs.settleRun).toHaveBeenCalledWith({
                runId: "r-1",
                status: "done",
                steps: [
                    { label: "Soan", status: "done" },
                    { label: "automations.decision.approved{}", status: "done", workItemId: "w-1" },
                ],
                evidence: 'automations.decision.evidence{"by":"Lan","outcome":"approved"}',
            })
            expect(pipelineService.saveLadder).toHaveBeenCalledWith("p-1", 20, NOW)
            expect(office.logEvidence).toHaveBeenCalledWith("ws-1", {
                kind: "automation.trust_offered",
                actor: "NIVO",
                summary: 'automations.decision.trustOffered{"name":"Thank","streak":20}',
                evidence: "20",
            })
        })
        it.each([
            ["rejected", "skipped"],
            ["edited", "done"],
        ] as const)("settles an owner's %s decision", async (outcome, status) => {
            const { engine, runs, pipelineService, office } = await build(setupOf())
            runs.waitingRunsFor.mockResolvedValue([waiting])
            pipelineService.findPipelineById.mockResolvedValue(buildPipelineRow({ id: "p-1", approval_streak: 3 }))
            await engine.onBusinessEvent(decision({ work_item_id: "w-1", outcome }))
            expectPartialCall(runs.settleRun, {
                status,
                steps: [expect.anything(), { label: `automations.decision.${outcome}{}`, status, workItemId: "w-1" }],
            })
            expect(pipelineService.saveLadder).toHaveBeenCalledWith("p-1", 0, null)
            expect(office.logEvidence).not.toHaveBeenCalled()
        })
        it("ends the run even when its pipeline is gone, and ignores a decision with no work item", async () => {
            const { engine, runs, pipelineService } = await build(setupOf())
            runs.waitingRunsFor.mockResolvedValue([waiting])
            pipelineService.findPipelineById.mockResolvedValue(null)
            await engine.onBusinessEvent(decision({ work_item_id: "w-1" }))
            await engine.onBusinessEvent(decision({}))
            expect(runs.settleRun).toHaveBeenCalledTimes(1)
            expect(pipelineService.saveLadder).not.toHaveBeenCalled()
            expect(runs.waitingRunsFor).toHaveBeenCalledTimes(1)
        })
    })
    describe("fireTemplate", () => {
        const request = {
            workspaceId: "ws-1",
            templateKey: "thank_payment",
            dedupe: "d-1",
            triggerRef: "t-1",
            payload: { a: 1 },
        }
        it("writes a run for later when the pipeline is on", async () => {
            const { engine, care, runs, pipelineService } = await build(setupOf("thank_payment"))
            care.executors.mockReturnValue({ thank_payment: jest.fn() })
            runs.beginRun.mockResolvedValue(null)
            await expect(engine.fireTemplate(request)).resolves.toBe(true)
            expect(pipelineService.enabledPipelinesOf).toHaveBeenCalledWith("ws-1")
            expectPartialCall(runs.beginRun, {
                dedupe: "d-1",
                triggerRef: "t-1",
                runAt: new Date("2026-10-12T10:00:05.000Z"),
            })
        })
        it("does nothing when the pipeline is off", async () => {
            const { engine, runs } = await build({ pipelines: [], templates: [template("thank_payment")] })
            await expect(engine.fireTemplate(request)).resolves.toBe(false)
            expect(runs.beginRun).not.toHaveBeenCalled()
        })
    })
    describe("runTick", () => {
        const now = new Date(NOW)
        it("executes the runs that are due and counts them", async () => {
            const { engine, care, runs, extensions } = await build(setupOf("thank_payment", "ask_review"))
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
            const { engine, care, extensions, scans, runs } = await build(setupOf("debt_reminder", "contract_renewal"))
            care.executors.mockReturnValue({ debt_reminder: jest.fn() })
            extensions.scan.mockResolvedValueOnce(null).mockResolvedValueOnce(2)
            scans.planScan.mockResolvedValue({
                runs: [{ dedupe: "debt:i-1:1", triggerRef: "i-1", payload: { a: 1 } }],
                events: [{ dedupe: "contract.expiring:c-1:2026-10-20", data: { contract_id: "c-1" } }],
            })
            runs.beginRun.mockResolvedValue(null)
            await expect(engine.runTick(now)).resolves.toEqual({ pipelines: 2, runs: 2 + 2 })
            expect(scans.planScan).toHaveBeenCalledTimes(1)
            expectPartialCall(runs.beginRun, { dedupe: "debt:i-1:1", triggerRef: "i-1", runAt: undefined })
        })
        it("lets an extension start a run through the scan context", async () => {
            const { engine, care, extensions, runs } = await build(setupOf("debt_reminder"))
            care.executors.mockReturnValue({ debt_reminder: jest.fn() })
            runs.beginRun.mockResolvedValue(null)
            extensions.scan.mockImplementation(async (context) => {
                await context.trigger("d-1", "t-1", { a: 1 })
                return 1
            })
            await engine.runTick(now)
            expectPartialCall(runs.beginRun, { dedupe: "d-1", triggerRef: "t-1" })
        })
        it("logs a failing scan and goes on", async () => {
            const { engine, scans, logger } = await build(setupOf("debt_reminder"))
            const failure = new Error("scan failed")
            scans.planScan.mockRejectedValue(failure)
            await expect(engine.runTick(now)).resolves.toEqual({ pipelines: 1, runs: 0 })
            expect(logger.error).toHaveBeenCalledWith(AutomationsLogEvent.ScanFailed, failure, {
                template: "debt_reminder",
            })
        })
        it("reads the shop of a workspace once and stops when the time budget is spent", async () => {
            const { engine, clock, runs, shop, scans, care } = await build({
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
            const { engine, shop } = await build(setupOf("thank_payment", "ask_review"))
            await engine.runTick(now)
            expect(shop.shopOf).toHaveBeenCalledTimes(1)
        })
        describe("the scheduled n8n workflows", () => {
            const scheduled = (time = "17:00") =>
                n8nSetup(
                    "email-daily-report",
                    {
                        settings: [{ key: "time", kind: "time", label: { vi: "a", en: "b" } }],
                        defaults: { time: "17:00" },
                        trigger: { kind: "schedule", event: "schedule.daily", line: { vi: "a", en: "b" } },
                        n8n: { webhook: "nivo/daily", audience: "owner" },
                    },
                    { config: { time } },
                )
            it("starts the run that is due and counts it", async () => {
                const { engine, n8nRuns } = await build(scheduled())
                n8nRuns.startRun.mockResolvedValue("run-1")
                await expect(engine.runTick(now)).resolves.toEqual({ pipelines: 0, runs: 1 })
                expectPartialCall(n8nRuns.startRun, {
                    templateKey: "email-daily-report",
                    webhookPath: "nivo/daily",
                    data: { date: "2026-10-12" },
                    dedupe: "day:2026-10-12",
                })
            })
            it("counts nothing for a run that was already started, a workflow that is not due and one that is not scheduled", async () => {
                const started = await build(scheduled())
                started.n8nRuns.startRun.mockResolvedValue(null)
                const notDue = await build(scheduled("23:00"))
                const notScheduled = await build(n8nSetup("email-payment-receipt"))
                await expect(started.engine.runTick(now)).resolves.toEqual({ pipelines: 0, runs: 0 })
                await expect(notDue.engine.runTick(now)).resolves.toEqual({ pipelines: 0, runs: 0 })
                await notScheduled.engine.runTick(now)
                expect(notDue.n8nRuns.startRun).not.toHaveBeenCalled()
                expect(notScheduled.n8nRuns.startRun).not.toHaveBeenCalled()
            })
            it("logs a workflow that cannot be started", async () => {
                const { engine, n8nRuns, logger } = await build(scheduled())
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
            const { engine, pipelineService } = await build(setupOf())
            await expect(engine.tickNow()).resolves.toEqual({ pipelines: 0, runs: 0 })
            expect(pipelineService.enabledPipelines).toHaveBeenCalledTimes(2)
        })
    })
})
