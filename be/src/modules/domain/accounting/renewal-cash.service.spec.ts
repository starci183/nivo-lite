import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { ContractsReadService } from "@modules/domain/contracts"
import type { ContractFacts } from "@modules/domain/contracts"
import { InvoiceEntity } from "@modules/domain/invoices"
import { LeadReadService } from "@modules/domain/leads"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
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

const invoiceOf = (changes: Partial<InvoiceEntity>): InvoiceEntity =>
    Object.assign(new InvoiceEntity(), {
        invoiceNo: "INV-1",
        amountVnd: 500_000,
        contractId: "c1",
        leadId: null,
        periodEndsOn: "2026-11-05",
        dueAt: new Date("2026-10-31T17:00:00.000Z"),
        ...changes,
    })

/** What the statements answer, in the order the reader runs them: invoices issued, paid, unpaid, renewed, then the two unmatched reads. */
const build = async (reads: {
    readonly issued?: ReadonlyArray<InvoiceEntity>
    readonly paid?: ReadonlyArray<InvoiceEntity>
    readonly unpaid?: ReadonlyArray<InvoiceEntity>
    readonly renewed?: ReadonlyArray<InvoiceEntity>
    readonly contracts?: ReadonlyArray<ContractFacts>
    readonly ending?: ReadonlyArray<ContractFacts>
}) => {
    const entityManager = mockEntityManager()
    const tx = fakeTransaction(entityManager)
    const answers: ReadonlyArray<QueryBuilderAnswers> = [
        { getMany: [...(reads.issued ?? [])] },
        { getMany: [...(reads.paid ?? [])] },
        { getMany: [...(reads.unpaid ?? [])] },
        ...((reads.ending ?? []).length === 0 ? [] : [{ getMany: [...(reads.renewed ?? [])] }]),
        { getRawOne: { count: 1, total: 100_000 } },
        { getRawMany: [{ amount_vnd: 100_000, sender_name: null, memo: "CK" }] },
    ]
    const fakes = answers.map((answer) => fakeQueryBuilder(answer))
    let next = 0
    entityManager.createQueryBuilder.mockImplementation(() => {
        const fake = fakes[Math.min(next, fakes.length - 1)]
        next += 1
        return (fake ?? fakes[0]).builder
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
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: ContractsReadService, useValue: contracts },
            { provide: LeadReadService, useValue: leads },
        ],
    }).compile()
    return { service: moduleRef.get(RenewalCashService), tx, contracts, leads }
}

describe("RenewalCashService", () => {
    it("reads every part of the story in one repeatable-read snapshot and joins the contracts in code", async () => {
        const { service, tx, contracts } = await build({
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
            renewed: [invoiceOf({ contractId: "c3", periodEndsOn: "2026-11-05" })],
        })

        const facts = await service.read(queryOf())

        expect(tx.outcomes).toEqual(["commit"])
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
