import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkItemsService } from "@modules/domain/work-items"
import type { WorkItem } from "@modules/domain/decisions"
import { itemOf } from "@tests/fixtures/builders/reconcile-payment-performer.builder"
import { AccountingFactReaderService, SUPPLIER_PAYMENT_AMOUNT } from "./accounting-fact-reader.service"
import { ACCOUNTING_GATEWAY } from "./accounting-gateway.decorators"
import type { AccountingGateway, PaymentCredit } from "./accounting-gateway.port"

const SUBJECT = { type: "invoice", id: "", workItemId: "item-1" }
const DEBITS: ReadonlyArray<PaymentCredit> = [
    { creditRef: "d-1", reference: "TT HD 17", amountVnd: 4_620_000, occurredAt: "", matched: true },
    { creditRef: "d-2", reference: "chuyen tien NCC", amountVnd: 7_500_000, occurredAt: "", matched: false },
]
const QUESTION: WorkItem = itemOf({
    action: "confirm_supplier_payment",
    subject_type: "invoice",
    subject_id: null,
    created_at: "2026-10-20T00:00:00.000Z",
    proposal: { summary: "Payment", amount_vnd: 1, fields: { debit_ref: "d-2" } },
})

const build = async (item: WorkItem | null, debits: ReadonlyArray<PaymentCredit> = DEBITS) => {
    const items = mock<WorkItemsService>({ findMany: jest.fn().mockResolvedValue(item === null ? [] : [item]) })
    const gateway = mock<AccountingGateway>({
        listPaymentDebits: jest.fn().mockResolvedValue({ tool: "bank", value: debits }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountingFactReaderService,
            { provide: WorkItemsService, useValue: items },
            { provide: ACCOUNTING_GATEWAY, useValue: gateway },
        ],
    }).compile()
    return { reader: moduleRef.get(AccountingFactReaderService), items, gateway }
}

describe("AccountingFactReaderService", () => {
    it("declares the amount of the supplier payment as a number of dong", async () => {
        const { reader } = await build(QUESTION)

        expect(reader.facts).toEqual([
            {
                key: SUPPLIER_PAYMENT_AMOUNT,
                type: "number",
                unit: "vnd",
                labelKey: "agentGraphs.fact.supplier_payment.amount_vnd",
            },
        ])
    })

    it("reads the amount from the payment the question names, never from the amount on the proposal", async () => {
        const { reader, items, gateway } = await build(QUESTION)

        await expect(reader.read("ws-1", SUBJECT, [SUPPLIER_PAYMENT_AMOUNT])).resolves.toEqual({
            [SUPPLIER_PAYMENT_AMOUNT]: 7_500_000,
        })

        expect(items.findMany).toHaveBeenCalledWith(["item-1"], 1)
        expect(gateway.listPaymentDebits).toHaveBeenCalledWith("ws-1", "2026-08-21T00:00:00.000Z")
    })

    it("reads nothing when the fact is not asked for, and does not touch the books", async () => {
        const { reader, items } = await build(QUESTION)

        await expect(reader.read("ws-1", SUBJECT, ["other.fact"])).resolves.toEqual({})
        expect(items.findMany).not.toHaveBeenCalled()
    })

    it.each([
        ["no such question", null],
        ["a question of another workspace", itemOf({ ...QUESTION, workspace_id: "ws-2" })],
        ["a question of another action", itemOf({ ...QUESTION, action: "issue_invoice" })],
        ["a question that kept no payment reference", itemOf({ ...QUESTION, proposal: { summary: "x", fields: {} } })],
    ])("leaves the fact absent for %s", async (_name, item) => {
        const { reader, gateway } = await build(item)

        await expect(reader.read("ws-1", SUBJECT, [SUPPLIER_PAYMENT_AMOUNT])).resolves.toEqual({})
        expect(gateway.listPaymentDebits).not.toHaveBeenCalled()
    })

    it("leaves the fact absent when the connector does not report that payment", async () => {
        const { reader } = await build(QUESTION, [])

        await expect(reader.read("ws-1", SUBJECT, [SUPPLIER_PAYMENT_AMOUNT])).resolves.toEqual({})
    })
})
