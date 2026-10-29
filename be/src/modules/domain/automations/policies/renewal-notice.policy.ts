import type { GateFields } from "../automation-ports.contracts"
import type { RenewalPayment } from "../automations.contracts"
import type { ContractRead, LeadRead } from "../automation-reads.contracts"

/**
 * The facts of a renewal that ride the authority gate to the follow-up performer, which turns them into the ZNS notice a Zalo OA sends
 * outside the 48-hour chat window. The names are the contract with that performer (`renewalNoticeOf`); the amount is whole dong in digits.
 */
export const renewalNoticeFields = (contract: ContractRead, lead: LeadRead, payment: RenewalPayment): GateFields => ({
    renewal_customer: lead.contact_name,
    renewal_phone: lead.phone ?? "",
    renewal_plan: contract.plan.trim(),
    renewal_end_date: contract.ends_on,
    renewal_amount_vnd: String(payment.amountVnd),
    renewal_transfer_content: payment.transferContent,
    renewal_invoice: payment.invoiceNo,
})
