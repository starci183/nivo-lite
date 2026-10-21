import { Test } from "@nestjs/testing"
import {
    draftOf,
    einvoiceOf,
    payableOf,
    paymentCreditOf,
    receivableOf,
    recordedOf,
} from "./mcp-accounting-gateway.mapper"

const SUBJECT = Symbol("mcp-accounting-gateway.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { draftOf, einvoiceOf, payableOf, paymentCreditOf, receivableOf, recordedOf },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./mcp-accounting-gateway.mapper")>(SUBJECT)
}

const DRAFT = {
    source: "pdf",
    template: "1",
    series: "C26TAA",
    invoiceNo: "0000123",
    issuedOn: "2026-10-19",
    sellerName: "Linen Co",
    sellerTaxCode: "0312345678",
    buyerName: "Guesthouse",
    buyerTaxCode: "0398765432",
    lines: [{ name: "Towels", quantity: 10, amountVnd: 1_000_000, vatRate: 8 }, "not a line", { name: "Soap" }],
    subtotalVnd: 1_000_000,
    vatVnd: 80_000,
    totalVnd: 1_080_000,
}

describe("mcp-accounting-gateway.mapper", () => {
    describe("draftOf", () => {
        it("reads a pdf draft, keeps the readable lines and zeroes what is missing or not a number", async () => {
            const mapper = await build()

            expect(mapper.draftOf(DRAFT)).toEqual({
                ...DRAFT,
                lines: [
                    { name: "Towels", quantity: 10, amountVnd: 1_000_000, vatRate: 8 },
                    { name: "Soap", quantity: 0, amountVnd: 0, vatRate: null },
                ],
            })
        })

        it("treats any other source as xml and reads no lines when they are not a list", async () => {
            const mapper = await build()

            const draft = mapper.draftOf({ source: "scan", lines: "x", totalVnd: Number.NaN, template: 7 })

            expect(draft).toMatchObject({ source: "xml", lines: [], totalVnd: 0, template: "" })
        })

        it("answers null for a value that is not an object", async () => {
            const mapper = await build()

            expect(mapper.draftOf(null)).toBeNull()
            expect(mapper.draftOf([DRAFT])).toBeNull()
            expect(mapper.draftOf("draft")).toBeNull()
        })
    })

    describe("einvoiceOf", () => {
        it("reads a row with an id and a draft", async () => {
            const mapper = await build()

            expect(mapper.einvoiceOf({ id: "inv-1", draft: DRAFT })).toMatchObject({
                ref: "inv-1",
                draft: { invoiceNo: "0000123" },
            })
        })

        it("answers null for a row without a draft, without an id or that is not an object", async () => {
            const mapper = await build()

            expect(mapper.einvoiceOf({ id: "inv-1" })).toBeNull()
            expect(mapper.einvoiceOf({ draft: DRAFT })).toBeNull()
            expect(mapper.einvoiceOf(7)).toBeNull()
        })
    })
})

describe("mcp-accounting-gateway.mapper payments", () => {
    describe("payableOf", () => {
        it("reads an invoice row as a supplier payable", async () => {
            const mapper = await build()

            expect(
                mapper.payableOf({
                    number: "0000123",
                    sellerName: "Linen Co",
                    sellerTaxCode: "0312345678",
                    totalVnd: 1_080_000,
                    issuedOn: "2026-10-19",
                }),
            ).toEqual({
                supplier: "Linen Co",
                sellerTaxCode: "0312345678",
                invoiceNo: "0000123",
                amountVnd: 1_080_000,
                issuedOn: "2026-10-19",
            })
        })

        it("answers null for a row without a number or that is not an object", async () => {
            const mapper = await build()

            expect(mapper.payableOf({ sellerName: "Linen Co" })).toBeNull()
            expect(mapper.payableOf(undefined)).toBeNull()
        })
    })

    describe("paymentCreditOf", () => {
        it("reads a matched credit with its memo as the reference", async () => {
            const mapper = await build()

            expect(
                mapper.paymentCreditOf({
                    id: "txn-1",
                    reference: "PAY F7K2Q9",
                    amountVnd: 12_800_000,
                    occurredAt: "2026-10-19T08:00:00Z",
                    status: "matched",
                }),
            ).toEqual({
                creditRef: "txn-1",
                reference: "PAY F7K2Q9",
                amountVnd: 12_800_000,
                occurredAt: "2026-10-19T08:00:00Z",
                matched: true,
            })
        })

        it("reads an unmatched credit and answers null without an id or for a value that is not an object", async () => {
            const mapper = await build()

            expect(mapper.paymentCreditOf({ id: "txn-2", status: "unmatched" })).toMatchObject({
                matched: false,
                amountVnd: 0,
            })
            expect(mapper.paymentCreditOf({ reference: "x" })).toBeNull()
            expect(mapper.paymentCreditOf(null)).toBeNull()
        })
    })
})

describe("mcp-accounting-gateway.mapper receivables", () => {
    describe("receivableOf", () => {
        it("reads the receivable the connector found and drops what the role does not define", async () => {
            const mapper = await build()

            expect(
                mapper.receivableOf({ found: true, receivableId: "rc-1", balanceVnd: 12_800_000, guest: "x" }),
            ).toEqual({
                receivableId: "rc-1",
                balanceVnd: 12_800_000,
            })
        })

        it("answers null when the connector found none or names no receivable", async () => {
            const mapper = await build()

            expect(mapper.receivableOf({ found: false })).toBeNull()
            expect(mapper.receivableOf({ found: true })).toBeNull()
            expect(mapper.receivableOf({ receivableId: "rc-1" })).toBeNull()
        })
    })

    describe("recordedOf", () => {
        it("counts an answer naming the payment as recorded, a duplicate included", async () => {
            const mapper = await build()

            expect(mapper.recordedOf({ paymentId: "p-1", duplicate: true })).toBe(true)
            expect(mapper.recordedOf({})).toBe(false)
        })
    })
})
