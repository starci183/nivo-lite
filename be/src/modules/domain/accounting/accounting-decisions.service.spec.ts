import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import {
    AccountingDecisionsService,
    RECORD_RECEIVABLE_PAYMENT,
    supplierPaymentKey,
} from "./accounting-decisions.service"

const WS = "ws-1"
const CTX = { workspaceId: WS, actor: "NIVO", locale: "vi" }

const build = async () => {
    const engine = mock<WorkEngineService>({
        runWork: jest.fn(() => Promise.resolve(mock<WorkItem>({ id: "wi-1" }))),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [AccountingDecisionsService, { provide: WorkEngineService, useValue: engine }],
    }).compile()
    return { decisions: moduleRef.get(AccountingDecisionsService), engine }
}

describe("AccountingDecisionsService", () => {
    it("opens a payment that differs from the balance as a preset decision, once per credit", async () => {
        const { decisions, engine } = await build()
        const credit = {
            creditRef: "SP-9",
            reference: "CK PAY F7K2Q9",
            amountVnd: 5_000_000,
            occurredAt: "",
            matched: false,
        }

        await expect(
            decisions.askPayment(WS, {
                receivable: { receivableId: "rc-1", balanceVnd: 12_800_000 },
                credit,
                summary: "Payment differs",
            }),
        ).resolves.toEqual({ kind: "work_item", id: "wi-1" })

        expect(engine.runWork).toHaveBeenCalledWith(CTX, {
            action: RECORD_RECEIVABLE_PAYMENT,
            subject_type: "transaction",
            dedupeKey: "record_receivable_payment:SP-9",
            preset: true,
            noChain: true,
            forceAsk: "unclear_outcome",
            seed: {
                summary: "Payment differs",
                amount_vnd: 5_000_000,
                fields: { receivable_id: "rc-1", credit_ref: "SP-9", reference: "CK PAY F7K2Q9" },
            },
        })
    })
})

describe("AccountingDecisionsService decision-only questions", () => {
    it("opens a partly matching supplier payment as a decision-only confirmation, once per invoice", async () => {
        const { decisions, engine } = await build()
        const payable = {
            supplier: "Linh An",
            sellerTaxCode: "0100109106",
            invoiceNo: "17",
            amountVnd: 4_620_000,
            issuedOn: "2026-10-19",
        }
        const debit = {
            creditRef: "d-1",
            reference: "TT LINH AN",
            amountVnd: 4_620_000,
            occurredAt: "",
            matched: false,
        }

        const question = { payable, debit, payableId: "pay-1", unclear: true, summary: "Confirm" }

        await expect(decisions.askSupplierPayment(WS, question)).resolves.toEqual({ kind: "work_item", id: "wi-1" })

        expect(supplierPaymentKey(payable)).toBe("confirm_supplier_payment:0100109106:17")
        expect(engine.runWork).toHaveBeenCalledWith(CTX, {
            action: "confirm_supplier_payment",
            subject_type: "supplier_payable",
            subject_id: "pay-1",
            dedupeKey: "confirm_supplier_payment:0100109106:17",
            preset: true,
            noChain: true,
            forceAsk: "unclear_outcome",
            seed: {
                summary: "Confirm",
                amount_vnd: 4_620_000,
                fields: { invoice_no: "17", seller_tax_code: "0100109106", debit_ref: "d-1" },
            },
        })
    })

    it("leaves an exact supplier payment to the gate and the action graph: no forced ask", async () => {
        const { decisions, engine } = await build()
        const payable = {
            supplier: "Linh An",
            sellerTaxCode: "0100109106",
            invoiceNo: "17",
            amountVnd: 4_620_000,
            issuedOn: "2026-10-19",
        }
        const debit = { creditRef: "d-1", reference: "HD 17", amountVnd: 4_620_000, occurredAt: "", matched: true }

        await decisions.askSupplierPayment(WS, { payable, debit, payableId: "pay-1", unclear: false, summary: "Paid" })

        expect(engine.runWork).toHaveBeenCalledWith(CTX, expect.objectContaining({ forceAsk: undefined, subject_id: "pay-1" }))
    })

    it("opens an e-invoice exception as a decision-only review, once per invoice", async () => {
        const { decisions, engine } = await build()

        await expect(decisions.askInvoiceReview(WS, { ref: "r-1:0", summary: "Check the tax code" })).resolves.toEqual({
            kind: "work_item",
            id: "wi-1",
        })

        expect(engine.runWork).toHaveBeenCalledWith(CTX, {
            action: "review_einvoice",
            subject_type: "invoice",
            dedupeKey: "review_einvoice:r-1:0",
            preset: true,
            noChain: true,
            forceAsk: "unclear_outcome",
            seed: { summary: "Check the tax code", fields: { invoice_ref: "r-1:0" } },
        })
    })
})
