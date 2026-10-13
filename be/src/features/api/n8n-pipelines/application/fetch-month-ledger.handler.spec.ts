import { mock } from "@starci/jest-preset"
import type { MonthLedger, N8nDoorService } from "@modules/domain/n8n-runs"
import type { Logger } from "@modules/platform/logging"
import { FetchMonthLedgerHandler } from "./fetch-month-ledger.handler"
import { FetchMonthLedgerQuery } from "./fetch-month-ledger.query"

const LEDGER: MonthLedger = {
    csv: "date,amount\n2026-09-01,100000",
    period: "2026-09",
    filename: "ledger-2026-09.csv",
    rows: 1,
    variables: { period: "2026-09", total: "100000" },
}

const build = (period: string = "2026-09") => {
    const logger = mock<Logger>()
    const door = mock<N8nDoorService>()
    const handler = new FetchMonthLedgerHandler(logger, door)
    const message = new FetchMonthLedgerQuery({ request: { authorization: "Bearer run-token", period } })
    return { logger, door, handler, message }
}

describe("FetchMonthLedgerHandler", () => {
    it("passes the bearer and requested month to the door and returns the exact ledger", async () => {
        const { logger, door, handler, message } = build()
        door.monthLedger.mockResolvedValue(LEDGER)

        await expect(handler.execute(message)).resolves.toEqual(LEDGER)

        expect(door.monthLedger).toHaveBeenCalledTimes(1)
        expect(door.monthLedger).toHaveBeenCalledWith("Bearer run-token", "2026-09")
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("preserves an empty month for the door's default", async () => {
        const { door, handler, message } = build("")
        door.monthLedger.mockResolvedValue(LEDGER)

        await expect(handler.execute(message)).resolves.toEqual(LEDGER)

        expect(door.monthLedger).toHaveBeenCalledWith("Bearer run-token", "")
    })

    it("logs and rethrows the door failure", async () => {
        const { logger, door, handler, message } = build()
        const failure = new Error("Month ledger failed")
        door.monthLedger.mockRejectedValue(failure)

        await expect(handler.execute(message)).rejects.toBe(failure)

        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith("cqrs.operation.failed", failure, {
            operation: "FetchMonthLedgerHandler",
        })
    })
})
