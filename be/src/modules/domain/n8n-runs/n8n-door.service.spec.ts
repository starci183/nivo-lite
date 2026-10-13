import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AutomationTemplatesService } from "@modules/domain/automation-templates"
import type { TemplateDefinition } from "@modules/domain/automation-templates"
import { N8nRunsErrorCode } from "./errors/n8n-runs.error"
import { N8nDataService } from "./n8n-data.service"
import { N8nDoorService } from "./n8n-door.service"
import { N8nEmailService } from "./n8n-email.service"
import type { DaySummary, MonthLedger, N8nEmailAnswer, N8nRunContext, OverdueInvoices } from "./n8n-runs.contracts"
import { N8nRunsService } from "./n8n-runs.service"

const TEXT = { vi: "Xin chao", en: "Hello" }

const template = (overrides: Partial<TemplateDefinition>): TemplateDefinition => ({
    key: "thank_payment",
    version: 1,
    position: 1,
    pack: "core",
    executor: "implemented",
    moduleKey: "sales",
    icon: "payment",
    name: TEXT,
    description: TEXT,
    trigger: { kind: "event", event: "payment.received", line: TEXT },
    requires: { modules: [], channels: [], connections: [], capabilities: [] },
    settings: [],
    contentMode: "none",
    guardrails: [],
    variables: [],
    defaultBody: null,
    authority: { action: null },
    defaults: {},
    ...overrides,
})

const DAY: DaySummary = {
    date: "2026-10-12",
    shop_name: "Shop",
    owners: [],
    numbers: {},
    variables: {},
}
const OVERDUE: OverdueInvoices = { shop_name: "Shop", items: [], skipped: { no_email: 0, reminded_recently: 0 } }
const LEDGER: MonthLedger = { csv: "", period: "2026-09", filename: "f.csv", rows: 0, variables: {} }
const ANSWER: N8nEmailAnswer = {
    status: "sent",
    via: null,
    workItemId: null,
    emailMessageId: null,
    messageId: null,
    error: null,
}
const RUN: N8nRunContext = { runId: "run-1", workspaceId: "ws-1", templateKey: "email-daily-report", config: { a: 1 } }

const build = async (audience: "owner" | "customer" | null = "owner") => {
    const runs = mock<N8nRunsService>()
    runs.verifyRun.mockResolvedValue(RUN)
    runs.requireRun.mockReturnValue(RUN)
    runs.requireWorkflow.mockReturnValue(RUN)
    const data = mock<N8nDataService>()
    const email = mock<N8nEmailService>()
    const templates = mock<AutomationTemplatesService>()
    templates.templateOf.mockResolvedValue(template(audience === null ? {} : { n8n: { webhook: "nivo/x", audience } }))
    const moduleRef = await Test.createTestingModule({
        providers: [
            N8nDoorService,
            { provide: N8nRunsService, useValue: runs },
            { provide: N8nDataService, useValue: data },
            { provide: N8nEmailService, useValue: email },
            { provide: AutomationTemplatesService, useValue: templates },
        ],
    }).compile()
    return { door: moduleRef.get(N8nDoorService), runs, data, email, templates }
}

describe("N8nDoorService", () => {
    describe("the data doors", () => {
        it("serves the day figures to the daily report run, today when no date is named", async () => {
            const { door, runs, data } = await build()
            data.dailySummary.mockResolvedValue(DAY)

            await expect(door.daySummary("Bearer t", "")).resolves.toBe(DAY)
            await door.daySummary("Bearer t", "2026-10-01")

            expect(runs.verifyRun).toHaveBeenCalledWith({ authorization: "Bearer t", expectedRunId: undefined })
            expect(runs.requireWorkflow).toHaveBeenCalledWith(RUN, "email-daily-report")
            expect(data.dailySummary).toHaveBeenNthCalledWith(1, "ws-1", null)
            expect(data.dailySummary).toHaveBeenNthCalledWith(2, "ws-1", "2026-10-01")
        })

        it("serves the overdue invoices to the debt reminder run with its settings", async () => {
            const { door, runs, data } = await build()
            data.overdueInvoices.mockResolvedValue(OVERDUE)

            await expect(door.overdueInvoices("Bearer t")).resolves.toBe(OVERDUE)

            expect(runs.requireWorkflow).toHaveBeenCalledWith(RUN, "email-debt-reminder")
            expect(data.overdueInvoices).toHaveBeenCalledWith("ws-1", { a: 1 })
        })

        it("serves a month of the ledger to the month ledger run, last month when none is named", async () => {
            const { door, runs, data } = await build()
            data.monthLedger.mockResolvedValue(LEDGER)

            await door.monthLedger("Bearer t", "")
            await door.monthLedger("Bearer t", "2026-09")

            expect(runs.requireWorkflow).toHaveBeenCalledWith(RUN, "email-month-ledger")
            expect(data.monthLedger).toHaveBeenNthCalledWith(1, "ws-1", null)
            expect(data.monthLedger).toHaveBeenNthCalledWith(2, "ws-1", "2026-09")
        })
    })

    describe("sendEmail", () => {
        it("cleans what the workflow sent and sends it to the audience of the template", async () => {
            const { door, email, templates } = await build("customer")
            email.sendEmail.mockResolvedValue(ANSWER)

            await expect(
                door.sendEmail("Bearer t", {
                    to: "a@b.c",
                    variables: { ok: "x", bad: {} },
                    refs: { lead_id: "l-1", nested: {} },
                    dedupe: "d-1",
                    attachments: [{ filename: "a.csv", content: "x" }],
                }),
            ).resolves.toBe(ANSWER)

            expect(templates.templateOf).toHaveBeenCalledWith("email-daily-report")
            expect(email.sendEmail).toHaveBeenCalledWith(RUN, "customer", {
                to: "a@b.c",
                variables: { ok: "x" },
                refs: { lead_id: "l-1" },
                dedupe: "d-1",
                attachments: [{ filename: "a.csv", content: "x", contentType: undefined, encoding: "utf8" }],
            })
        })

        it("refuses a run whose template sends no email", async () => {
            const { door } = await build(null)

            await expect(
                door.sendEmail("Bearer t", {
                    to: "a@b.c",
                    variables: {},
                    refs: {},
                    dedupe: undefined,
                    attachments: [],
                }),
            ).rejects.toMatchObject({ code: N8nRunsErrorCode.WorkflowMismatch })
        })
    })

    describe("completeRun", () => {
        it("closes the run its own token names", async () => {
            const { door, runs } = await build()

            await expect(door.completeRun("Bearer t", "run-1", { status: "done" })).resolves.toBeUndefined()

            expect(runs.verifyRun).toHaveBeenCalledWith({ authorization: "Bearer t", expectedRunId: "run-1" })
            expect(runs.completeRun).toHaveBeenCalledWith(RUN, { status: "done" })
        })
    })
})
