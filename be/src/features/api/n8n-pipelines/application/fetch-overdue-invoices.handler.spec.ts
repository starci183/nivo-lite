import { mock } from "@starci/jest-preset"
import type { N8nDoorService, OverdueInvoices } from "@modules/domain/n8n-runs"
import type { Logger } from "@modules/platform/logging"
import { FetchOverdueInvoicesHandler } from "./fetch-overdue-invoices.handler"
import { FetchOverdueInvoicesQuery } from "./fetch-overdue-invoices.query"

const INVOICES: OverdueInvoices = {
    shop_name: "Shop",
    items: [
        {
            to: "customer@example.com",
            dedupe: "invoice-1:2026-10-12",
            refs: { invoice_id: "invoice-1" },
            variables: { amount: 100000, invoice_no: "INV-1" },
        },
    ],
    skipped: { no_email: 1, reminded_recently: 2 },
}

const build = () => {
    const logger = mock<Logger>()
    const door = mock<N8nDoorService>()
    const handler = new FetchOverdueInvoicesHandler(logger, door)
    const message = new FetchOverdueInvoicesQuery({ request: { authorization: "Bearer run-token" } })
    return { logger, door, handler, message }
}

describe("FetchOverdueInvoicesHandler", () => {
    it("passes the bearer to the door and returns the exact overdue invoice response", async () => {
        const { logger, door, handler, message } = build()
        door.overdueInvoices.mockResolvedValue(INVOICES)

        await expect(handler.execute(message)).resolves.toEqual(INVOICES)

        expect(door.overdueInvoices).toHaveBeenCalledTimes(1)
        expect(door.overdueInvoices).toHaveBeenCalledWith("Bearer run-token")
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs and rethrows the door failure", async () => {
        const { logger, door, handler, message } = build()
        const failure = new Error("Overdue invoices failed")
        door.overdueInvoices.mockRejectedValue(failure)

        await expect(handler.execute(message)).rejects.toBe(failure)

        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith("cqrs.operation.failed", failure, {
            operation: "FetchOverdueInvoicesHandler",
        })
    })
})
