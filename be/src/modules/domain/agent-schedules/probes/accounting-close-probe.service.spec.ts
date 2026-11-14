import { Test } from "@nestjs/testing"
import { AccountingCloseProbeService, ACCOUNTING_CLOSE_PROBE } from "./accounting-close-probe.service"

describe("AccountingCloseProbeService", () => {
    it("is named by the key the graph reads, and always has work, even on a day with no money", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [AccountingCloseProbeService] }).compile()
        const probe = moduleRef.get(AccountingCloseProbeService)

        expect(probe.key).toBe(ACCOUNTING_CLOSE_PROBE)
        expect(probe.key).toBe("accounting_close")
        await expect(probe.check()).resolves.toEqual({
            work: true,
            brief: "Close the books for the day.",
            subjectIds: [],
        })
    })
})
