import { INVOICE_COLUMNS, INVOICE_RETURNING, INVOICE_VIEW_COLUMNS, selectColumns } from "./invoice-columns.policy"
import type { InvoiceColumn } from "./invoice-columns.policy"

type Call = readonly [method: string, expression: string, alias: string]

interface FakeQuery {
    readonly calls: Call[]
    select(expression: string, alias: string): FakeQuery
    addSelect(expression: string, alias: string): FakeQuery
}

const fakeQuery = (): FakeQuery => {
    const calls: Call[] = []
    const query: FakeQuery = {
        calls,
        select: (expression, alias) => {
            calls.push(["select", expression, alias])
            return query
        },
        addSelect: (expression, alias) => {
            calls.push(["addSelect", expression, alias])
            return query
        },
    }
    return query
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
    it("replaces the selection with the first column and adds the rest", () => {
        const columns: ReadonlyArray<InvoiceColumn> = [
            ["i.id", "id"],
            ["i.status", "status"],
            ["i.invoiceNo", "invoice_no"],
        ]
        const query = fakeQuery()

        const result = selectColumns(query as never, columns)

        expect(result).toBe(query)
        expect(query.calls).toEqual([
            ["select", "i.id", "id"],
            ["addSelect", "i.status", "status"],
            ["addSelect", "i.invoiceNo", "invoice_no"],
        ])
    })

    it("answers the query untouched for no columns", () => {
        const query = fakeQuery()

        expect(selectColumns(query as never, [])).toBe(query)
        expect(query.calls).toEqual([])
    })
})
