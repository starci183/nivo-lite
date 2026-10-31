import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { InvoicesLedgerService } from "@modules/domain/invoices"
import { CLOCK } from "@modules/platform/clock"
import { InvoicesDueProbeService } from "./invoices-due-probe.service"

const NOW = "2026-11-10T03:00:00.000Z"
const AGENT = { workspaceId: "ws-1", agentId: "agent-1" }
const overdue = (invoiceNo: string) => ({ id: `id-${invoiceNo}`, invoiceNo, amountVnd: 1, dueAt: null, leadId: null })

describe("InvoicesDueProbeService", () => {
    const build = async (invoices: ReadonlyArray<ReturnType<typeof overdue>>) => {
        const ledger = mock<InvoicesLedgerService>({ overdueBefore: jest.fn().mockResolvedValue(invoices) })
        const container = await Test.createTestingModule({
            providers: [
                InvoicesDueProbeService,
                { provide: InvoicesLedgerService, useValue: ledger },
                { provide: CLOCK, useValue: new FakeClock(NOW) },
            ],
        }).compile()
        return { probe: container.get(InvoicesDueProbeService), ledger }
    }

    it("names the overdue invoices, at most five ids", async () => {
        const six = ["1", "2", "3", "4", "5", "6"].map(overdue)
        const { probe, ledger } = await build(six)

        await expect(probe.check(AGENT)).resolves.toEqual({
            work: true,
            brief: "Invoices past due: 1; 2; 3; 4; 5; and 1 more.",
            subjectIds: ["id-1", "id-2", "id-3", "id-4", "id-5"],
        })
        expect(ledger.overdueBefore).toHaveBeenCalledWith("ws-1", new Date(NOW), 6)
        expect(probe.key).toBe("invoices_due")
    })

    it("finds no work when none is overdue", async () => {
        const { probe } = await build([])

        await expect(probe.check(AGENT)).resolves.toEqual({ work: false })
    })
})
