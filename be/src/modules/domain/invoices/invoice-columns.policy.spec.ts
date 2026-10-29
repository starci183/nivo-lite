import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { InvoiceColumn } from "./invoice-columns.policy"
import { INVOICE_COLUMNS, INVOICE_RETURNING, INVOICE_VIEW_COLUMNS, selectColumns } from "./invoice-columns.policy"

const SUBJECT = Symbol("invoice-columns.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { selectColumns } }],
    }).compile()
    return moduleRef.get<Pick<typeof import("./invoice-columns.policy"), "selectColumns">>(SUBJECT)
}

const queryOf = () => {
    const fake = fakeQueryBuilder()
    return { query: fake.builder, fake }
}

describe("invoice columns", () => {
    it("lists the record columns with their aliases", () => {
        expect(INVOICE_COLUMNS.map(([, alias]) => alias)).toEqual([
            "id",
            "workspace_id",
            "order_id",
            "lead_id",
            "invoice_no",
            "amount_vnd",
            "status",
            "issued_by",
            "paid_at",
            "contract_id",
            "period_ends_on",
        ])
    })

    it("lists the view columns, with the dates as ISO text", () => {
        expect(INVOICE_VIEW_COLUMNS.map(([, alias]) => alias)).toEqual([
            "id",
            "workspace_id",
            "order_id",
            "lead_id",
            "invoice_no",
            "amount_vnd",
            "status",
            "issued_by",
            "paid_at",
            "contract_id",
            "period_ends_on",
            "due_at",
            "issued_at",
            "created_at",
        ])
        expect(INVOICE_VIEW_COLUMNS[8]).toEqual(["to_json(i.paid_at) #>> '{}'", "paid_at"])
    })

    it("names the returning clause", () => {
        expect(INVOICE_RETURNING).toBe(
            "id, workspace_id, order_id, lead_id, invoice_no, amount_vnd::float8 AS amount_vnd, status, issued_by, paid_at::text AS paid_at, contract_id, period_ends_on::text AS period_ends_on",
        )
    })
})

describe("selectColumns", () => {
    it("replaces the selection with the first column and adds the rest", async () => {
        const { selectColumns } = await buildSubject()
        const columns: ReadonlyArray<InvoiceColumn> = [
            ["i.id", "id"],
            ["i.status", "status"],
            ["i.invoiceNo", "invoice_no"],
        ]
        const { query, fake } = queryOf()

        const result = selectColumns(query, columns)

        expect(result).toBe(query)
        expect(fake.callsOf("select")).toEqual([["i.id", "id"]])
        expect(fake.callsOf("addSelect")).toEqual([
            ["i.status", "status"],
            ["i.invoiceNo", "invoice_no"],
        ])
    })

    it("answers the query untouched for no columns", async () => {
        const { selectColumns } = await buildSubject()
        const { query, fake } = queryOf()

        expect(selectColumns(query, [])).toBe(query)
        expect(fake.calls).toEqual([])
    })
})
