import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { N8nRunsErrorCode } from "./errors/n8n-runs.error"
import { N8nDataService } from "./n8n-data.service"
import { N8nEmailService } from "./n8n-email.service"
import type { N8nMailer, N8nRunContext } from "./n8n-runs.contracts"
import { N8N_MAILER } from "./n8n-runs.decorators"

const run = (templateKey: string, config: N8nRunContext["config"]): N8nRunContext => ({
    runId: "run-1",
    workspaceId: "ws-1",
    templateKey,
    config,
})

const CONFIG = { subject: "Hi {ten_shop}\nthere", body: "Dear {name}" }
const REQUEST = {
    to: " Owner@Shop.VN ",
    variables: { ten_shop: "Tiem Hoa", name: "Lan" },
    refs: {},
    dedupe: undefined,
    attachments: [],
}

const build = async () => {
    const mailer = mock<N8nMailer>()
    mailer.sendOwnerEmail.mockResolvedValue({ status: "sent", via: "smtp", messageId: "m-1" })
    mailer.requestCustomerEmail.mockResolvedValue({ status: "waiting_decision", workItemId: "w-1" })
    const data = mock<N8nDataService>()
    data.ownerRecipients.mockResolvedValue([{ email: "owner@shop.vn", name: "Lan" }])
    data.shopName.mockResolvedValue("Shop")
    const moduleRef = await Test.createTestingModule({
        providers: [
            N8nEmailService,
            { provide: N8N_MAILER, useValue: mailer },
            { provide: N8nDataService, useValue: data },
        ],
    }).compile()
    return { email: moduleRef.get(N8nEmailService), mailer, data }
}

describe("N8nEmailService", () => {
    describe("sendEmail to an owner", () => {
        it("renders the shop's template and mails an owner of the workspace", async () => {
            const { email, mailer } = await build()

            await expect(email.sendEmail(run("email-daily-report", CONFIG), "owner", REQUEST)).resolves.toEqual({
                status: "sent",
                via: "smtp",
                workItemId: null,
                emailMessageId: null,
                messageId: "m-1",
                error: null,
            })

            expect(mailer.sendOwnerEmail).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                to: "owner@shop.vn",
                subject: "Hi Tiem Hoa there",
                shopName: "Tiem Hoa",
                text: "Dear Lan",
                attachments: [],
                purpose: "daily_report",
                refs: { run_id: "run-1" },
            })
        })

        it("asks for the name of the shop when the workflow did not send it", async () => {
            const { email, mailer } = await build()

            await email.sendEmail(run("email-daily-report", CONFIG), "owner", {
                ...REQUEST,
                variables: { name: "Lan" },
            })

            expect(mailer.sendOwnerEmail).toHaveBeenCalledWith(expect.objectContaining({ shopName: "Shop" }))
        })

        it("also mails the accountant of a month ledger and records an unnamed workflow as a pipeline", async () => {
            const { email, mailer } = await build()

            await email.sendEmail(
                run("email-month-ledger", { ...CONFIG, accountant_email: " Acc@Firm.vn " }),
                "owner",
                { ...REQUEST, to: "acc@firm.vn" },
            )
            await email.sendEmail(run("email-other", CONFIG), "owner", REQUEST)

            expect(mailer.sendOwnerEmail).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({ to: "acc@firm.vn", purpose: "month_ledger" }),
            )
            expect(mailer.sendOwnerEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({ purpose: "pipeline" }))
        })

        it("does not let the accountant receive any other workflow", async () => {
            const { email } = await build()

            await expect(
                email.sendEmail(run("email-daily-report", { ...CONFIG, accountant_email: "acc@firm.vn" }), "owner", {
                    ...REQUEST,
                    to: "acc@firm.vn",
                }),
            ).rejects.toMatchObject({ code: N8nRunsErrorCode.RecipientBlocked })
        })

        it("refuses an address that is not an owner of the workspace", async () => {
            const { email, mailer } = await build()

            await expect(
                email.sendEmail(run("email-daily-report", CONFIG), "owner", { ...REQUEST, to: "stranger@x.com" }),
            ).rejects.toMatchObject({ code: N8nRunsErrorCode.RecipientBlocked })

            expect(mailer.sendOwnerEmail).not.toHaveBeenCalled()
        })
    })
})

describe("N8nEmailService", () => {
    describe("sendEmail to a customer", () => {
        it("asks the gate for the email, filed under the invoice, with the dedupe the workflow gave", async () => {
            const { email, mailer } = await build()

            await expect(
                email.sendEmail(run("email-debt-reminder", CONFIG), "customer", {
                    ...REQUEST,
                    refs: { invoice_id: "i-1", lead_id: "l-1" },
                    dedupe: "d".repeat(200),
                }),
            ).resolves.toMatchObject({ status: "waiting_decision", workItemId: "w-1" })

            expect(mailer.requestCustomerEmail).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                to: "owner@shop.vn",
                subject: "Hi Tiem Hoa there",
                body: "Dear Lan",
                purpose: "debt_reminder",
                refs: { invoice_id: "i-1", lead_id: "l-1", run_id: "run-1" },
                dedupeKey: `send_email:email-debt-reminder:${"d".repeat(120)}`,
                subjectType: "invoice",
                subjectId: "i-1",
                leadId: "l-1",
            })
        })

        it("files a receipt under its transaction and makes a stable dedupe key when none was given", async () => {
            const { email, mailer } = await build()
            const request = { ...REQUEST, refs: { transaction_id: "t-1", invoice_id: "i-1" } }

            await email.sendEmail(run("email-payment-receipt", CONFIG), "customer", request)
            await email.sendEmail(run("email-payment-receipt", CONFIG), "customer", request)

            const [first, second] = mailer.requestCustomerEmail.mock.calls.map(([sent]) => sent)
            expect(first).toMatchObject({
                subjectType: "transaction",
                subjectId: "t-1",
                leadId: null,
                purpose: "receipt",
            })
            expect(first?.dedupeKey).toMatch(/^send_email:email-payment-receipt:[0-9a-f]{32}$/)
            expect(second?.dedupeKey).toBe(first?.dedupeKey)
        })

        it("files under no subject when the references name none", async () => {
            const { email, mailer } = await build()

            await email.sendEmail(run("email-debt-reminder", CONFIG), "customer", REQUEST)

            expect(mailer.requestCustomerEmail).toHaveBeenCalledWith(expect.objectContaining({ subjectId: null }))
        })
    })

    describe("sendEmail without a template", () => {
        it.each([
            ["recipient", { ...REQUEST, to: "  " }, CONFIG],
            ["subject", REQUEST, { body: "x" }],
            ["body", REQUEST, { subject: "x" }],
        ])("refuses an email with no %s", async (_name, request, config) => {
            const { email } = await build()

            await expect(email.sendEmail(run("email-daily-report", config), "owner", request)).rejects.toMatchObject({
                code: N8nRunsErrorCode.EmailIncomplete,
            })
        })
    })
})
