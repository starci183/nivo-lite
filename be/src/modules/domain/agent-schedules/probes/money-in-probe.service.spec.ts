import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { InvoicesCashReadService } from "@modules/domain/invoices"
import { CLOCK } from "@modules/platform/clock"
import { MoneyInProbeService } from "./money-in-probe.service"

const NOW = "2026-11-10T03:00:00.000Z"
const DAY_AGO = new Date("2026-11-09T03:00:00.000Z")
const AGENT = { workspaceId: "ws-1", agentId: "agent-1" }

describe("MoneyInProbeService", () => {
    const build = async (total: number) => {
        const cash = mock<InvoicesCashReadService>({ paidTotalSince: jest.fn().mockResolvedValue(total) })
        const container = await Test.createTestingModule({
            providers: [
                MoneyInProbeService,
                { provide: InvoicesCashReadService, useValue: cash },
                { provide: CLOCK, useValue: new FakeClock(NOW) },
            ],
        }).compile()
        return { probe: container.get(MoneyInProbeService), cash }
    }

    it("states what was paid over the last day", async () => {
        const { probe, cash } = await build(1_500_000)

        await expect(probe.check(AGENT)).resolves.toEqual({
            work: true,
            brief: "Invoices paid in the last 24 hours add up to 1500000 VND.",
            subjectIds: [],
        })
        expect(cash.paidTotalSince).toHaveBeenCalledWith("ws-1", DAY_AGO)
        expect(probe.key).toBe("money_in")
    })

    it("finds no work when nothing was paid", async () => {
        const { probe } = await build(0)

        await expect(probe.check(AGENT)).resolves.toEqual({ work: false })
    })
})
