import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { FakeQueryBuilder, QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { InvoicesErrorCode } from "./errors/invoices.error"
import { INVOICE_RETURNING } from "./invoice-columns.policy"
import type {
    InvoiceAccountingRecord,
    InvoiceListingRecord,
    InvoiceRecord,
    InvoiceViewRecord,
    NewInvoice,
    NewRenewalInvoice,
    ReconcileInvoiceRecord,
} from "./invoices.contracts"
import { InvoicesService } from "./invoices.service"

const WS = "11111111-1111-4111-8111-111111111111"
const INVOICE: InvoiceRecord = {
    id: "inv-1",
    workspace_id: WS,
    order_id: "o1",
    lead_id: "l1",
    invoice_no: "HD-01",
    amount_vnd: 50_000,
    status: "issued",
    issued_by: null,
    paid_at: null,
    contract_id: null,
    period_ends_on: null,
}
const NOW = "2026-10-13T10:00:00.000Z"
const DUE_AT = "2026-10-28T10:00:00.000Z"
const INPUT: NewInvoice = { workspaceId: WS, orderId: "o1", leadId: "l1", amountVnd: 50_000, issuedBy: "Lan" }
const CONTRACT = "c1"
const PERIOD = "2026-11-30"
const RENEWAL: InvoiceRecord = {
    ...INVOICE,
    id: "inv-r1",
    order_id: null,
    invoice_no: "INV-202610-0043",
    amount_vnd: 900_000,
    issued_by: null,
    contract_id: CONTRACT,
    period_ends_on: PERIOD,
}
const RENEWAL_INPUT: NewRenewalInvoice = {
    workspaceId: WS,
    contractId: CONTRACT,
    leadId: "l1",
    amountVnd: 900_000,
    periodEndsOn: PERIOD,
    issuedBy: null,
}
const VIEW: InvoiceViewRecord = { ...INVOICE, due_at: DUE_AT, issued_at: NOW, created_at: NOW }

const build = async (em: MockEntityManager): Promise<InvoicesService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            InvoicesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T10:00:00.000Z") },
        ],
    }).compile()
    return moduleRef.get(InvoicesService)
}

/** A manager that hands out one query builder per call, answering `answers` in order. */
const queued = (answers: ReadonlyArray<QueryBuilderAnswers>) => {
    const em = mockEntityManager()
    return { em, fakes: queueQueryBuilders(em, answers) }
}

/** The answers of an insert that wrote `rows`, of a read that found `row`, and of a list of `rows`. */
const inserted = (rows: ReadonlyArray<unknown>): QueryBuilderAnswers => ({ execute: { raw: rows } })
const found = (row: unknown): QueryBuilderAnswers => ({ getRawOne: row })
const listed = (rows: ReadonlyArray<unknown>): QueryBuilderAnswers => ({ getRawMany: rows })

/** What an insert query builder was told to write. */
const writtenBy = (fake: FakeQueryBuilder | undefined): unknown => fake?.callsOf("values")[0]?.[0]

/** What the clock-dated insert of an order invoice writes under a number. */
const orderValues = (invoiceNo: string, orderId: string | null = "o1") => ({
    workspaceId: WS,
    orderId,
    leadId: "l1",
    invoiceNo,
    amountVnd: 50_000,
    dueAt: new Date(DUE_AT),
    issuedBy: "Lan",
    issuedAt: new Date(NOW),
    status: "issued",
})

/** What the clock-dated insert of a renewal invoice writes under a number. */
const renewalValues = (invoiceNo: string, periodEndsOn: string = PERIOD) => ({
    workspaceId: WS,
    contractId: CONTRACT,
    periodEndsOn,
    leadId: "l1",
    invoiceNo,
    amountVnd: 900_000,
    dueAt: new Date(DUE_AT),
    issuedBy: null,
    issuedAt: new Date(NOW),
    status: "issued",
})

describe("InvoicesService finds", () => {
    it("finds the customer's newest open invoice", async () => {
        const { em, fakes } = queued([found(INVOICE)])
        const service = await build(em)

        await expect(service.latestOfLead(WS, "l1", "issued")).resolves.toEqual(INVOICE)
        expect(fakes[0]?.callsOf("andWhere")).toEqual([
            ["i.leadId = :leadId AND i.status = :status", { leadId: "l1", status: "issued" }],
        ])
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["i.created_at", "DESC"]])
    })

    it("orders the newest paid invoice by payment time first", async () => {
        const { em, fakes } = queued([found({ ...INVOICE, status: "paid" })])
        const service = await build(em)

        await service.latestOfLead(WS, "l1", "paid")

        expect(fakes[0]?.callsOf("orderBy")).toEqual([["i.paid_at", "DESC", "NULLS LAST"]])
        expect(fakes[0]?.callsOf("addOrderBy")).toEqual([["i.created_at", "DESC"]])
    })

    it("answers null when the customer has no invoice in that state", async () => {
        const { em } = queued([found(undefined)])
        const service = await build(em)

        await expect(service.latestOfLead(WS, "l1", "paid")).resolves.toBeNull()
    })

    it("finds one invoice of the workspace", async () => {
        const { em, fakes } = queued([found(INVOICE)])
        const service = await build(em)

        await expect(service.find(WS, "inv-1")).resolves.toEqual(INVOICE)
        expect(fakes[0]?.callsOf("where")).toEqual([["i.workspaceId = :workspaceId", { workspaceId: WS }]])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([["i.id = :invoiceId", { invoiceId: "inv-1" }]])
    })

    it("answers null for an invoice the workspace does not have", async () => {
        const { em } = queued([found(undefined)])
        const service = await build(em)

        await expect(service.find(WS, "missing")).resolves.toBeNull()
    })

    it("reads the invoice of an order, or null when it has none", async () => {
        const { em, fakes } = queued([found(INVOICE), found(undefined)])
        const service = await build(em)

        await expect(service.ofOrder(WS, "o1")).resolves.toEqual(INVOICE)
        await expect(service.ofOrder(WS, "o2")).resolves.toBeNull()
        expect(fakes.map((fake) => fake.callsOf("andWhere"))).toEqual([
            [["i.orderId = :orderId", { orderId: "o1" }]],
            [["i.orderId = :orderId", { orderId: "o2" }]],
        ])
    })
})

describe("InvoicesService finds contract periods", () => {
    it("reads the renewal invoice of a contract period, or null when it has none", async () => {
        const { em, fakes } = queued([found(RENEWAL), found(undefined)])
        const service = await build(em)

        await expect(service.forContractPeriod(WS, CONTRACT, PERIOD)).resolves.toEqual(RENEWAL)
        await expect(service.forContractPeriod(WS, CONTRACT, "2026-12-31")).resolves.toBeNull()
        expect(fakes[1]?.callsOf("andWhere")).toEqual([
            [
                "i.contractId = :contractId AND i.period_ends_on = :periodEndsOn",
                { contractId: CONTRACT, periodEndsOn: "2026-12-31" },
            ],
        ])
    })

    it.each([
        ["find", [found(RENEWAL)], (service: InvoicesService) => service.find(WS, "inv-r1"), "select"],
        ["ofOrder", [found(RENEWAL)], (service: InvoicesService) => service.ofOrder(WS, "o1"), "select"],
        [
            "latestOfLead",
            [found(RENEWAL)],
            (service: InvoicesService) => service.latestOfLead(WS, "l1", "issued"),
            "select",
        ],
        [
            "forContractPeriod",
            [found(RENEWAL)],
            (service: InvoicesService) => service.forContractPeriod(WS, CONTRACT, PERIOD),
            "select",
        ],
        [
            "issue",
            [found(undefined), inserted([RENEWAL])],
            (service: InvoicesService) => service.issue(INPUT),
            "returning",
        ],
        [
            "issueRenewal",
            [found(undefined), found(undefined), inserted([RENEWAL])],
            (service: InvoicesService) => service.issueRenewal(RENEWAL_INPUT),
            "returning",
        ],
        ["markPaid", [inserted([RENEWAL])], (service: InvoicesService) => service.markPaid(WS, "inv-r1"), "returning"],
    ] as const)("selects the contract and its period in invoice statement %s", async (_name, answers, run, how) => {
        const { em, fakes } = queued(answers)

        await run(await build(em))

        const statement = fakes[fakes.length - 1]
        const selected = [...(statement?.callsOf("select") ?? []), ...(statement?.callsOf("addSelect") ?? [])]
            .map(([expression]) => String(expression))
            .join(" ")
        const text = how === "select" ? selected : String(statement?.callsOf("returning")[0]?.[0])
        expect(text).toContain(how === "select" ? "i.contractId" : "contract_id")
        expect(text).toContain(how === "select" ? "i.period_ends_on::text" : "period_ends_on::text AS period_ends_on")
    })
})

describe("InvoicesService lists", () => {
    it("lists the newest issued invoices up to the requested limit", async () => {
        const row: InvoiceListingRecord = { ...INVOICE, order_no: "ORDER-1", contact_name: "Minh" }
        const { em, fakes } = queued([listed([row]), listed([])])
        const service = await build(em)

        await expect(service.listIssued(WS, 20)).resolves.toEqual([row])
        await expect(service.listIssued(WS, 10)).resolves.toEqual([])
        expect(fakes.map((fake) => fake.callsOf("limit"))).toEqual([[[20]], [[10]]])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([["i.status = 'issued'"]])
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["i.created_at", "DESC"]])
    })

    it("lists accounting invoices with the default or requested limit", async () => {
        const row: InvoiceAccountingRecord = { ...VIEW, order: null, lead: null }
        const { em, fakes } = queued([listed([row]), listed([])])
        const service = await build(em)

        await expect(service.listAccounting(WS)).resolves.toEqual([row])
        await expect(service.listAccounting(WS, 25)).resolves.toEqual([])
        expect(fakes.map((fake) => fake.callsOf("limit"))).toEqual([[[1000]], [[25]]])
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["i.created_at", "DESC"]])
        expect(fakes[0]?.callsOf("addOrderBy")).toEqual([["i.id", "DESC"]])
    })

    it("does not read reconciliation invoices for an empty selection", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.listForReconcile(WS, [])).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("reads at most fifty reconciliation invoices without changing the selection", async () => {
        const row: ReconcileInvoiceRecord = {
            id: INVOICE.id,
            invoice_no: INVOICE.invoice_no,
            amount_vnd: INVOICE.amount_vnd,
            status: INVOICE.status,
            customer: "Minh",
            company: null,
            order_no: "ORDER-1",
            order_items: "Tea",
            order_status: "invoiced",
            issued_at: NOW,
            due_at: DUE_AT,
        }
        const ids = Array.from({ length: 52 }, (_, index) => `inv-${index + 1}`)
        const { em, fakes } = queued([listed([row])])
        const service = await build(em)

        await expect(service.listForReconcile(WS, ids)).resolves.toEqual([row])
        expect(fakes[0]?.callsOf("where")).toEqual([
            ["i.workspaceId = :workspaceId AND i.id = ANY(:ids)", { workspaceId: WS, ids: ids.slice(0, 50) }],
        ])
        expect(fakes[0]?.callsOf("limit")).toEqual([[50]])
        expect(ids).toHaveLength(52)
        expect(ids[51]).toBe("inv-52")
    })
})

describe("InvoicesService view lists", () => {
    it("reads the workbench invoices with a limit of five hundred", async () => {
        const { em, fakes } = queued([listed([VIEW])])
        const service = await build(em)

        await expect(service.listForWorkbench(WS)).resolves.toEqual([VIEW])
        expect(fakes[0]?.callsOf("limit")).toEqual([[500]])
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["i.created_at", "ASC"]])
    })

    it("reads the invoices of one customer", async () => {
        const { em, fakes } = queued([listed([VIEW])])
        const service = await build(em)

        await expect(service.listForLead(WS, "l1")).resolves.toEqual([VIEW])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([["i.leadId = :leadId", { leadId: "l1" }]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[1000]])
    })
})

describe("InvoicesService issue", () => {
    it("issues the next monthly number with the clock's dates and issuer", async () => {
        const created = { ...INVOICE, invoice_no: "INV-202610-0043", issued_by: "Lan" }
        const { em, fakes } = queued([found({ invoice_no: "INV-202610-0042" }), inserted([created])])
        const service = await build(em)

        await expect(service.issue(INPUT)).resolves.toEqual({ invoice: created, created: true })
        expect(fakes[0]?.callsOf("where")).toEqual([
            [
                "i.workspaceId = :workspaceId AND i.invoiceNo LIKE :pattern",
                { workspaceId: WS, pattern: "INV-202610-%" },
            ],
        ])
        expect(writtenBy(fakes[1])).toEqual(orderValues("INV-202610-0043"))
        expect(fakes[1]?.callsOf("orIgnore")).toHaveLength(1)
        expect(fakes[1]?.callsOf("returning")).toEqual([[INVOICE_RETURNING]])
    })

    it.each([found(undefined), found({ invoice_no: null })])(
        "starts a month at one when no last number is present: %p",
        async (last) => {
            const created = { ...INVOICE, invoice_no: "INV-202610-0001", order_id: null, lead_id: null }
            const { em, fakes } = queued([last, inserted([created])])
            const service = await build(em)

            await expect(service.issue({ ...INPUT, orderId: null, leadId: null })).resolves.toEqual({
                invoice: created,
                created: true,
            })
            expect(writtenBy(fakes[1])).toEqual({ ...orderValues("INV-202610-0001", null), leadId: null })
        },
    )

    it("returns the order's existing invoice after an insert conflict", async () => {
        const { em, fakes } = queued([found(undefined), inserted([]), found(INVOICE)])
        const service = await build(em)

        await expect(service.issue(INPUT)).resolves.toEqual({ invoice: INVOICE, created: false })
        expect(writtenBy(fakes[1])).toEqual(orderValues("INV-202610-0001"))
        expect(fakes[2]?.callsOf("andWhere")).toEqual([["i.orderId = :orderId", { orderId: "o1" }]])
    })

    it("tries the following number when the conflicted order has no existing invoice", async () => {
        const created = { ...INVOICE, invoice_no: "INV-202610-0002" }
        const { em, fakes } = queued([found(undefined), inserted([]), found(undefined), inserted([created])])
        const service = await build(em)

        await expect(service.issue(INPUT)).resolves.toEqual({ invoice: created, created: true })
        expect(writtenBy(fakes[1])).toEqual(orderValues("INV-202610-0001"))
        expect(writtenBy(fakes[3])).toEqual(orderValues("INV-202610-0002"))
    })

    it("gives up after four taken numbers for an invoice without an order", async () => {
        const { em, fakes } = queued([
            found({ invoice_no: "INV-202610-0008" }),
            inserted([]),
            inserted([]),
            inserted([]),
            inserted([]),
        ])
        const service = await build(em)

        await expect(service.issue({ ...INPUT, orderId: null })).rejects.toMatchObject({
            code: InvoicesErrorCode.NotNumbered,
        })
        expect(fakes.slice(1).map((fake) => writtenBy(fake))).toEqual(
            ["0009", "0010", "0011", "0012"].map((no) => orderValues(`INV-202610-${no}`, null)),
        )
    })
})

describe("InvoicesService payment", () => {
    it("marks an invoice paid at the clock instant", async () => {
        const paid = { ...INVOICE, status: "paid", paid_at: NOW }
        const { em, fakes } = queued([inserted([paid])])
        const service = await build(em)

        await expect(service.markPaid(WS, "inv-1")).resolves.toEqual(paid)
        expect(fakes[0]?.callsOf("update")).toEqual([[]])
        expect(fakes[0]?.callsOf("set")).toEqual([[{ status: "paid", paidAt: new Date(NOW) }]])
        expect(fakes[0]?.callsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND id = :invoiceId AND status <> 'paid'",
                { workspaceId: WS, invoiceId: "inv-1" },
            ],
        ])
        expect(fakes[0]?.callsOf("returning")).toEqual([[INVOICE_RETURNING]])
    })

    it("keeps a paid invoice paid: it answers the invoice as it stands and never re-stamps paid_at", async () => {
        const standing = { ...INVOICE, status: "paid", paid_at: "2026-10-01 08:00:00+00" }
        const { em, fakes } = queued([inserted([]), found(standing)])
        const service = await build(em)

        await expect(service.markPaid(WS, "inv-1")).resolves.toEqual(standing)
        expect(fakes[0]?.callsOf("where")[0]?.[0]).toContain("status <> 'paid'")
        expect(fakes[1]?.callsOf("update")).toEqual([])
        expect(fakes[1]?.callsOf("where")).toEqual([
            ["i.workspaceId = :workspaceId AND i.id = :invoiceId", { workspaceId: WS, invoiceId: "inv-1" }],
        ])
    })

    it("writes through the supplied manager", async () => {
        const paid = { ...INVOICE, status: "paid", paid_at: NOW }
        const { em } = queued([])
        const { em: other, fakes } = queued([inserted([paid])])
        const service = await build(em)

        await expect(service.markPaid(WS, "inv-1", other)).resolves.toEqual(paid)
        expect(fakes[0]?.callsOf("update")).toEqual([[]])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("rejects payment when the invoice is absent from the workspace", async () => {
        const { em } = queued([inserted([]), found(undefined)])
        const service = await build(em)

        await expect(service.markPaid(WS, "missing")).rejects.toMatchObject({
            code: InvoicesErrorCode.NotFound,
        })
    })
})

describe("InvoicesService renewals", () => {
    it("issues a renewal invoice for a contract period with the next number, no order and the term due date", async () => {
        const { em, fakes } = queued([found(undefined), found({ invoice_no: "INV-202610-0042" }), inserted([RENEWAL])])
        const service = await build(em)

        await expect(service.issueRenewal(RENEWAL_INPUT)).resolves.toEqual({ invoice: RENEWAL, created: true })
        expect(fakes[0]?.callsOf("andWhere")).toEqual([
            [
                "i.contractId = :contractId AND i.period_ends_on = :periodEndsOn",
                { contractId: CONTRACT, periodEndsOn: PERIOD },
            ],
        ])
        expect(writtenBy(fakes[2])).toEqual(renewalValues("INV-202610-0043"))
    })

    it("answers the existing renewal invoice of the period without issuing another", async () => {
        const { em } = queued([found(RENEWAL)])
        const service = await build(em)

        await expect(service.issueRenewal(RENEWAL_INPUT)).resolves.toEqual({ invoice: RENEWAL, created: false })
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })

    it("issues a new invoice for the next period of the same contract", async () => {
        const next = { ...RENEWAL, id: "inv-r2", invoice_no: "INV-202610-0044", period_ends_on: "2026-12-31" }
        const { em, fakes } = queued([found(undefined), found({ invoice_no: "INV-202610-0043" }), inserted([next])])
        const service = await build(em)

        await expect(service.issueRenewal({ ...RENEWAL_INPUT, periodEndsOn: "2026-12-31" })).resolves.toEqual({
            invoice: next,
            created: true,
        })
        expect(writtenBy(fakes[2])).toEqual(renewalValues("INV-202610-0044", "2026-12-31"))
    })
})

describe("InvoicesService renewal clashes", () => {
    it("tries the following number when only the number clashed", async () => {
        const created = { ...RENEWAL, invoice_no: "INV-202610-0002" }
        const { em, fakes } = queued([
            found(undefined),
            found(undefined),
            inserted([]),
            found(undefined),
            inserted([created]),
        ])
        const service = await build(em)

        await expect(service.issueRenewal(RENEWAL_INPUT)).resolves.toEqual({ invoice: created, created: true })
        expect(writtenBy(fakes[2])).toEqual(renewalValues("INV-202610-0001"))
        expect(writtenBy(fakes[4])).toEqual(renewalValues("INV-202610-0002"))
    })

    it("answers the renewal a concurrent issuer wrote after the insert conflicted", async () => {
        const { em } = queued([found(undefined), found(undefined), inserted([]), found(RENEWAL)])
        const service = await build(em)

        await expect(service.issueRenewal(RENEWAL_INPUT)).resolves.toEqual({ invoice: RENEWAL, created: false })
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(4)
    })

    it("gives up a renewal after four taken numbers", async () => {
        const clashes = Array.from({ length: 4 }, () => [inserted([]), found(undefined)]).flat()
        const { em, fakes } = queued([found(undefined), found(undefined), ...clashes])
        const service = await build(em)

        await expect(service.issueRenewal(RENEWAL_INPUT)).rejects.toMatchObject({
            code: InvoicesErrorCode.NotNumbered,
        })
        expect(fakes.filter((fake) => fake.callsOf("insert").length > 0)).toHaveLength(4)
    })

    it("carries the contract and period through find and markPaid", async () => {
        const paid = { ...RENEWAL, status: "paid", paid_at: NOW }
        const { em } = queued([found(RENEWAL), inserted([paid])])
        const service = await build(em)

        await expect(service.find(WS, "inv-r1")).resolves.toMatchObject({
            contract_id: CONTRACT,
            period_ends_on: PERIOD,
        })
        await expect(service.markPaid(WS, "inv-r1")).resolves.toMatchObject({
            contract_id: CONTRACT,
            period_ends_on: PERIOD,
            status: "paid",
        })
    })
})
