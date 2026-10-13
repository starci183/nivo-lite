import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset"
import type { DaySummary, MonthLedger, N8nEmailAnswer, OverdueInvoices } from "@modules/domain/n8n-runs"
import { CompleteRunCommand } from "../../application/complete-run.command"
import { FetchDaySummaryQuery } from "../../application/fetch-day-summary.query"
import { FetchMonthLedgerQuery } from "../../application/fetch-month-ledger.query"
import { FetchOverdueInvoicesQuery } from "../../application/fetch-overdue-invoices.query"
import { SendEmailCommand } from "../../application/send-email.command"
import type { CompleteRunRequest } from "./dto/complete-run.request"
import type { SendEmailRequest } from "./dto/send-email.request"
import { N8nPipelinesController } from "./n8n-pipelines.controller"

const DAY: DaySummary = {
    date: "2026-10-12",
    shop_name: "Flower Shop",
    owners: [{ email: "owner@example.com", name: "Lan" }],
    numbers: { sales: 120 },
    variables: { sales: "120" },
}
const OVERDUE: OverdueInvoices = {
    shop_name: "Flower Shop",
    items: [
        {
            to: "customer@example.com",
            dedupe: "invoice-1:2026-10-12",
            refs: { invoiceId: "invoice-1" },
            variables: { total: 120 },
        },
    ],
    skipped: { no_email: 2, reminded_recently: 1 },
}
const LEDGER: MonthLedger = {
    csv: "date,total\n2026-09-12,120",
    period: "2026-09",
    filename: "ledger-2026-09.csv",
    rows: 1,
    variables: { total: "120" },
}
const EMAIL: SendEmailRequest = {
    to: "owner@example.com",
    variables: { sales: 120 },
    refs: { report: "daily" },
    dedupe: "daily:2026-10-12",
    attachments: [{ filename: "report.csv", content: "sales\n120" }],
}
const ANSWER: N8nEmailAnswer = {
    status: "sent",
    via: "platform",
    workItemId: "work-1",
    emailMessageId: "email-1",
    messageId: "message-1",
    error: null,
}
const COMPLETION: CompleteRunRequest = { status: "done", summary: "One email sent", result: { sent: 1 } }

const build = () => {
    const queryBus = mock<QueryBus>()
    const commandBus = mock<CommandBus>()
    const controller = new N8nPipelinesController(queryBus, commandBus)
    return { controller, queryBus, commandBus }
}

describe("N8nPipelinesController", () => {
    describe.each([
        { header: "Bearer run-token", authorization: "Bearer run-token" },
        { header: undefined, authorization: "" },
    ])("with authorization $authorization", ({ header, authorization }) => {
        it("dispatches the day summary query and returns its figures", async () => {
            const { controller, queryBus } = build()
            queryBus.execute.mockResolvedValue(DAY)

            await expect(controller.daySummary(header, { date: "2026-10-12" })).resolves.toEqual({
                date: "2026-10-12",
                shop_name: "Flower Shop",
                owners: [{ email: "owner@example.com", name: "Lan" }],
                numbers: { sales: 120 },
                variables: { sales: "120" },
            })

            expect(queryBus.execute).toHaveBeenCalledTimes(1)
            expect(queryBus.execute).toHaveBeenCalledWith(
                new FetchDaySummaryQuery({ request: { authorization, date: "2026-10-12" } }),
            )
        })

        it("dispatches the overdue invoices query and returns the reminders", async () => {
            const { controller, queryBus } = build()
            queryBus.execute.mockResolvedValue(OVERDUE)

            await expect(controller.overdueInvoices(header)).resolves.toEqual({
                shop_name: "Flower Shop",
                items: [
                    {
                        to: "customer@example.com",
                        dedupe: "invoice-1:2026-10-12",
                        refs: { invoiceId: "invoice-1" },
                        variables: { total: 120 },
                    },
                ],
                skipped: { no_email: 2, reminded_recently: 1 },
            })

            expect(queryBus.execute).toHaveBeenCalledTimes(1)
            expect(queryBus.execute).toHaveBeenCalledWith(new FetchOverdueInvoicesQuery({ request: { authorization } }))
        })

        it("dispatches the month ledger query and returns the CSV details", async () => {
            const { controller, queryBus } = build()
            queryBus.execute.mockResolvedValue(LEDGER)

            await expect(controller.monthLedger(header, { period: "2026-09" })).resolves.toEqual({
                csv: "date,total\n2026-09-12,120",
                period: "2026-09",
                filename: "ledger-2026-09.csv",
                rows: 1,
                variables: { total: "120" },
            })

            expect(queryBus.execute).toHaveBeenCalledTimes(1)
            expect(queryBus.execute).toHaveBeenCalledWith(
                new FetchMonthLedgerQuery({ request: { authorization, period: "2026-09" } }),
            )
        })

        it("maps the email into a command and maps the answer into HTTP fields", async () => {
            const { controller, commandBus } = build()
            commandBus.execute.mockResolvedValue(ANSWER)

            await expect(controller.email(header, EMAIL)).resolves.toEqual({
                status: "sent",
                via: "platform",
                work_item_id: "work-1",
                email_message_id: "email-1",
                message_id: "message-1",
                error: null,
            })

            expect(commandBus.execute).toHaveBeenCalledTimes(1)
            expect(commandBus.execute).toHaveBeenCalledWith(
                new SendEmailCommand({
                    request: {
                        authorization,
                        email: {
                            to: "owner@example.com",
                            variables: { sales: 120 },
                            refs: { report: "daily" },
                            dedupe: "daily:2026-10-12",
                            attachments: [{ filename: "report.csv", content: "sales\n120" }],
                        },
                    },
                }),
            )
        })

        it("dispatches the run id and mapped completion report", async () => {
            const { controller, commandBus } = build()
            commandBus.execute.mockResolvedValue(undefined)

            await expect(controller.complete(header, { id: "run-1" }, COMPLETION)).resolves.toBeUndefined()

            expect(commandBus.execute).toHaveBeenCalledTimes(1)
            expect(commandBus.execute).toHaveBeenCalledWith(
                new CompleteRunCommand({
                    request: {
                        authorization,
                        runId: "run-1",
                        report: { status: "done", summary: "One email sent", result: { sent: 1 } },
                    },
                }),
            )
        })
    })
})
