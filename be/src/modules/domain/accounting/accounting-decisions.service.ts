import { Injectable } from "@nestjs/common"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import type {
    GatewayPayable,
    HubCardRef,
    InvoiceQuestion,
    PaymentQuestion,
    SupplierPaymentQuestion,
} from "./accounting-desk.contracts"

/** The action whose approval records a payment credit on a receivable (performed by `ReceivablePaymentPerformerService`). */
export const RECORD_RECEIVABLE_PAYMENT = "record_receivable_payment"
/** The action whose decision records the chief accountant's verdict on an e-invoice exception; it has no performer. */
const REVIEW_EINVOICE = "review_einvoice"

/** The action whose decision confirms that an outgoing payment paid a supplier invoice; it has no performer. */
const CONFIRM_SUPPLIER_PAYMENT = "confirm_supplier_payment"

/** The one key of the decision about a supplier invoice's payment: the invoice is asked about once. */
export const supplierPaymentKey = (payable: GatewayPayable): string =>
    `${CONFIRM_SUPPLIER_PAYMENT}:${payable.sellerTaxCode}:${payable.invoiceNo}`

/** The engine context of the accounting desk's decisions: the desk itself, writing Vietnamese. */
const deskContext = (workspaceId: string): WorkContext => ({ workspaceId, actor: "NIVO", locale: "vi" })

@Injectable()
/**
 * Opens the accounting desk's exceptions as work items waiting for the chief accountant, through the existing decision flow
 * (`WorkEngineService.runWork`, preset, always asked), so the card's approve and decline buttons decide them like any other work
 * and a decline keeps its reason. Each question is opened once per credit or invoice (its dedupe key).
 */
export class AccountingDecisionsService {
    constructor(private readonly engine: WorkEngineService) {}

    /** Asks whether to record a payment that differs from the balance; approving it records the credit on the receivable. */
    async askPayment(workspaceId: string, question: PaymentQuestion): Promise<HubCardRef> {
        const { receivable, credit } = question
        const item = await this.engine.runWork(deskContext(workspaceId), {
            action: RECORD_RECEIVABLE_PAYMENT,
            subject_type: "transaction",
            dedupeKey: `${RECORD_RECEIVABLE_PAYMENT}:${credit.creditRef}`,
            preset: true,
            noChain: true,
            forceAsk: "unclear_outcome",
            seed: {
                summary: question.summary,
                amount_vnd: credit.amountVnd,
                fields: {
                    receivable_id: receivable.receivableId,
                    credit_ref: credit.creditRef,
                    reference: credit.reference,
                },
            },
        })
        return { kind: "work_item", id: item.id }
    }

    /** Asks whether an outgoing payment that only partly matches a supplier invoice paid it; approving it stops the reminders. */
    async askSupplierPayment(workspaceId: string, question: SupplierPaymentQuestion): Promise<HubCardRef> {
        const { payable, debit } = question
        const item = await this.engine.runWork(deskContext(workspaceId), {
            action: CONFIRM_SUPPLIER_PAYMENT,
            subject_type: "invoice",
            dedupeKey: supplierPaymentKey(payable),
            preset: true,
            noChain: true,
            forceAsk: "unclear_outcome",
            seed: {
                summary: question.summary,
                amount_vnd: debit.amountVnd,
                fields: {
                    invoice_no: payable.invoiceNo,
                    seller_tax_code: payable.sellerTaxCode,
                    debit_ref: debit.creditRef,
                },
            },
        })
        return { kind: "work_item", id: item.id }
    }

    /** Asks the chief accountant to decide an e-invoice the checks raised; the decision is recorded with its reason. */
    async askInvoiceReview(workspaceId: string, question: InvoiceQuestion): Promise<HubCardRef> {
        const item = await this.engine.runWork(deskContext(workspaceId), {
            action: REVIEW_EINVOICE,
            subject_type: "invoice",
            dedupeKey: `${REVIEW_EINVOICE}:${question.ref}`,
            preset: true,
            noChain: true,
            forceAsk: "unclear_outcome",
            seed: { summary: question.summary, fields: { invoice_ref: question.ref } },
        })
        return { kind: "work_item", id: item.id }
    }
}
