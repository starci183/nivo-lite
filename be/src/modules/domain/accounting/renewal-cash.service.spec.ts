import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { ContractsReadService } from "@modules/domain/contracts"
import type { ContractFacts } from "@modules/domain/contracts"
import { InboundPaymentsReadService } from "@modules/domain/inbound-events"
import { InvoicesCashReadService } from "@modules/domain/invoices"
import type { CashInvoice } from "@modules/domain/invoices"
import { LeadReadService } from "@modules/domain/leads"
import { RenewalCashService } from "./renewal-cash.service"
import type { RenewalCashQuery } from "./renewal-cash.service"

const WS = "ws-1"

const queryOf = builder<RenewalCashQuery>({
    workspaceId: WS,
    from: new Date("2026-10-26T17:00:00.000Z"),
    to: new Date("2026-10-27T17:00:00.000Z"),
    day: "2026-10-27",
    horizonDay: "2026-11-26",
    bound: 20,
})

const contractOf = builder<ContractFacts>({
    id: "c1",
    customerName: "Truong Phat",
    leadId: null,
    plan: "Gold",
    endsOn: "2026-11-05",
    amountVnd: 500_000,
    status: "active",
})

const invoiceOf = builder<CashInvoice>({
    invoiceNo: "INV-1",
    amountVnd: 500_000,
    contractId: "c1",
    leadId: null,
    periodEndsOn: "2026-11-05",
    issuedAt: null,
    dueAt: new Date("2026-10-31T17:00:00.000Z"),
    paidAt: null,
})

/** What the read services answer for the invoices, the contracts, the leads and the payments. */
const build = async (reads: {
    readonly issued?: ReadonlyArray<CashInvoice>
    readonly paid?: ReadonlyArray<CashInvoice>
    readonly unpaid?: ReadonlyArray<CashInvoice>
    readonly renewed?: ReadonlyArray<{ readonly contractId: string; readonly periodEndsOn: string }>
    readonly contracts?: ReadonlyArray<ContractFacts>
    readonly ending?: ReadonlyArray<ContractFacts>
}) => {
    const invoices = mock<InvoicesCashReadService>()
    invoices.renewalsIssued.mockResolvedValue([...(reads.issued ?? [])])
    invoices.renewalsPaid.mockResolvedValue([...(reads.paid ?? [])])
    invoices.unpaidDueBefore.mockResolvedValue([...(reads.unpaid ?? [])])
    invoices.invoicedPeriods.mockResolvedValue([...(reads.renewed ?? [])])
    const payments = mock<InboundPaymentsReadService>()
    payments.unmatched.mockResolvedValue({
        count: 1,
        total: 100_000,
        items: [{ amountVnd: 100_000, senderName: null, memo: "CK" }],
    })
    const contracts = mock<ContractsReadService>()
    contracts.contractsByIds.mockResolvedValue([...(reads.contracts ?? [])])
    contracts.activeEndingBetween.mockResolvedValue([...(reads.ending ?? [])])
    const leads = mock<LeadReadService>()
    leads.cardsOf.mockResolvedValue([
        { id: "l1", contactName: "Lead Name", company: "", channel: "web", stage: "new", email: null },
    ])
    const moduleRef = await Test.createTestingModule({
        providers: [
            RenewalCashService,
            { provide: InvoicesCashReadService, useValue: invoices },
            { provide: InboundPaymentsReadService, useValue: payments },
            { provide: ContractsReadService, useValue: contracts },
            { provide: LeadReadService, useValue: leads },
        ],
    }).compile()
    return { service: moduleRef.get(RenewalCashService), invoices, payments, contracts, leads }
}

describe("RenewalCashService", () => {
    it("reads every part of the story through the owners read services and joins the contracts in code", async () => {
        const { service, invoices, payments, contracts } = await build({
            issued: [invoiceOf({ invoiceNo: "INV-1" }), invoiceOf({ invoiceNo: "INV-X", contractId: "gone" })],
            paid: [
                invoiceOf({ invoiceNo: "INV-2", periodEndsOn: "2026-10-01" }),
                invoiceOf({ invoiceNo: "INV-4", periodEndsOn: null }),
            ],
            unpaid: [
                invoiceOf({ invoiceNo: "INV-3", amountVnd: 900_000, contractId: null, leadId: "l1" }),
                invoiceOf({ invoiceNo: "INV-5", contractId: null, leadId: null }),
                invoiceOf({ invoiceNo: "INV-6" }),
            ],
            contracts: [contractOf({})],
            ending: [contractOf({ id: "c2", customerName: "Lan Anh", amountVnd: null }), contractOf({ id: "c3" })],
            renewed: [{ contractId: "c3", periodEndsOn: "2026-11-05" }],
        })

        const facts = await service.read(queryOf())

        expect(invoices.renewalsIssued).toHaveBeenCalledWith(WS, queryOf().from, queryOf().to, 5000)
        expect(invoices.unpaidDueBefore).toHaveBeenCalledWith(WS, new Date("2026-11-26T17:00:00.000Z"), 5000)
        expect(invoices.invoicedPeriods).toHaveBeenCalledWith(WS, ["c2", "c3"])
        expect(payments.unmatched).toHaveBeenCalledWith(WS, 20)
        expect(facts.issued_count).toBe(1)
        expect(facts.issued).toEqual([{ invoice_no: "INV-1", amount_vnd: 500_000, customer_name: "Truong Phat" }])
        expect(facts.paid.map((item) => [item.invoice_no, item.extended])).toEqual([
            ["INV-2", true],
            ["INV-4", false],
        ])
        expect(facts.paid_total).toBe(1_000_000)
        expect(facts.unpaid.map((item) => [item.invoice_no, item.customer_name, item.due_on])).toEqual([
            ["INV-3", "Lead Name", "2026-11-01"],
            ["INV-5", null, "2026-11-01"],
            ["INV-6", "Truong Phat", "2026-11-01"],
        ])
        expect(facts.unpaid_total).toBe(1_900_000)
        expect(facts.expiring).toEqual([
            { customer_name: "Lan Anh", plan: "Gold", ends_on: "2026-11-05", amount_vnd: null },
        ])
        expect(facts.expiring_count).toBe(1)
        expect(facts.expiring_total).toBe(0)
        expect(facts.unmatched_count).toBe(1)
        expect(facts.unmatched).toEqual([{ amount_vnd: 100_000, sender_name: null, memo: "CK" }])
        expect(contracts.activeEndingBetween).toHaveBeenCalledWith(WS, "2026-10-27", "2026-11-26", 5000)
    })

    it("bounds each list but counts and totals every row", async () => {
        const many = Array.from({ length: 3 }, (_, at) => invoiceOf({ invoiceNo: `INV-${at}` }))
        const { service } = await build({ issued: many, contracts: [contractOf({})] })

        const facts = await service.read(queryOf({ bound: 2 }))

        expect(facts.issued).toHaveLength(2)
        expect(facts.issued_count).toBe(3)
        expect(facts.issued_total).toBe(1_500_000)
    })

    it("tells an empty workspace from one with no contract of its own", async () => {
        const { service, contracts } = await build({})

        const facts = await service.read(queryOf())

        expect(facts.issued_count).toBe(0)
        expect(facts.expiring_count).toBe(0)
        expect(contracts.contractsByIds).not.toHaveBeenCalled()
    })
})
