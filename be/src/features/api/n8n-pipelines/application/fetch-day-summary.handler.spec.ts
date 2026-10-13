import { mock } from "@starci/jest-preset"
import type { DaySummary, N8nDoorService } from "@modules/domain/n8n-runs"
import type { Logger } from "@modules/platform/logging"
import { FetchDaySummaryHandler } from "./fetch-day-summary.handler"
import { FetchDaySummaryQuery } from "./fetch-day-summary.query"

const SUMMARY: DaySummary = {
    date: "2026-10-12",
    shop_name: "Shop",
    owners: [{ email: "owner@example.com", name: "Owner" }],
    numbers: { sales: 100000, payments: 2 },
    variables: { date: "2026-10-12", sales: "100000" },
}

const build = (date: string = "2026-10-12") => {
    const logger = mock<Logger>()
    const door = mock<N8nDoorService>()
    const handler = new FetchDaySummaryHandler(logger, door)
    const message = new FetchDaySummaryQuery({ request: { authorization: "Bearer run-token", date } })
    return { logger, door, handler, message }
}

describe("FetchDaySummaryHandler", () => {
    it("passes the bearer and requested date to the door and returns the exact summary", async () => {
        const { logger, door, handler, message } = build()
        door.daySummary.mockResolvedValue(SUMMARY)

        await expect(handler.execute(message)).resolves.toEqual(SUMMARY)

        expect(door.daySummary).toHaveBeenCalledTimes(1)
        expect(door.daySummary).toHaveBeenCalledWith("Bearer run-token", "2026-10-12")
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("preserves an empty date for the door's default", async () => {
        const { door, handler, message } = build("")
        door.daySummary.mockResolvedValue(SUMMARY)

        await expect(handler.execute(message)).resolves.toEqual(SUMMARY)

        expect(door.daySummary).toHaveBeenCalledWith("Bearer run-token", "")
    })

    it("logs and rethrows the door failure", async () => {
        const { logger, door, handler, message } = build()
        const failure = new Error("Day summary failed")
        door.daySummary.mockRejectedValue(failure)

        await expect(handler.execute(message)).rejects.toBe(failure)

        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith("cqrs.operation.failed", failure, {
            operation: "FetchDaySummaryHandler",
        })
    })
})
