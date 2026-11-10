import { AccountingCloseProbeService, ACCOUNTING_CLOSE_PROBE } from "./accounting-close-probe.service"

describe("AccountingCloseProbeService", () => {
    it("is named by the key the graph reads, and always has work, even on a day with no money", async () => {
        const probe = new AccountingCloseProbeService()

        expect(probe.key).toBe(ACCOUNTING_CLOSE_PROBE)
        expect(probe.key).toBe("accounting_close")
        await expect(probe.check()).resolves.toEqual({
            work: true,
            brief: "Close the books for the day.",
            subjectIds: [],
        })
    })
})
