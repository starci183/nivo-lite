import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerCallFailure,
    providerRefusal,
    withProof,
    type InvoiceIssuePort,
    type InvoiceIssueRequest,
    type IssuedInvoice,
} from "@modules/domain/provider-registry"
import { ProviderSandboxService, type SandboxCallPlan, type SandboxState } from "@modules/domain/provider-sandbox"
import {
    MISA_SANDBOX_CASE,
    MISA_SANDBOX_CATALOGUE_DATE,
    MISA_SANDBOX_ISSUE_OPERATION,
    MISA_SANDBOX_PROVIDER,
    MISA_SANDBOX_SERIES,
} from "./misa-meinvoice-sandbox.catalogue"

/** State name: the next invoice number of the account (key ""), a positive integer; absent means 1. */
const NEXT = "next"

/** State name: the invoices issued so far, by draft id and by `invoice:<id>` (what a later read-back answers from). */
const INVOICE = "invoice"

/** The invoice number of a running number: the series, a slash and eight digits (`C26TSB/00000123`). */
const invoiceNoOf = (next: number): string => `${MISA_SANDBOX_SERIES}/${String(next).padStart(8, "0")}`

/** The next number of the account: 1 until an invoice is issued, then the number after the last one issued. */
const nextOf = async (state: SandboxState): Promise<number> => {
    const kept = await state.read(NEXT, "")
    return typeof kept === "number" && Number.isInteger(kept) && kept > 0 ? kept : 1
}

/** Issues one invoice on the account's state: takes the next number, keeps the invoice by draft id and by its own id. */
const issueOnState = async (state: SandboxState, draftId: string): Promise<IssuedInvoice> => {
    const next = await nextOf(state)
    const invoice: IssuedInvoice = { id: `sbx-inv-${String(next).padStart(8, "0")}`, state: "issued", invoiceNo: invoiceNoOf(next), issuedOn: MISA_SANDBOX_CATALOGUE_DATE }
    await state.write(INVOICE, draftId, invoice)
    await state.write(INVOICE, `invoice:${invoice.id}`, invoice)
    await state.write(NEXT, "", next + 1)
    return invoice
}

@Injectable()
/**
 * MISA meInvoice's SANDBOX implementation of the e-invoice issue port (R56 / R62): used when the provider account is a sandbox
 * account. It answers through the generic sandbox frame from the hardcoded catalogue (`MISA_MEINVOICE_SANDBOX_CATALOGUE`), reaches no
 * host and holds no secret; the frame logs every call.
 *
 * The account's sticky NEXT CASE picks the outcome, never the request's draft id: MISA-1 (default) issues an invoice with the account's
 * next number (`C26TSB/` and eight digits, from state) and the catalogue's fixed issue date (`issuedOn` 2026-11-14); MISA-2 is refused `rejected` (an invalid buyer tax code, `not_sent`); MISA-3
 * gives no answer (the unknown-outcome call failure, proof `unknown`, nothing issued); MISA-4 is a server failure (`not_sent`); MISA-5
 * is refused `auth_refused` (`not_sent`); MISA-6 issues and numbers the invoice, then loses the answer (`unknown`, the invoice exists).
 * Numbers are GAPLESS per account: only an invoice that exists (MISA-1, MISA-6) takes the next number; a rejected, refused, failed or
 * no-answer issue consumes none. The invoice is kept by draft id and by `invoice:<id>` for a later read-back (the port has none today).
 *
 * UNVERIFIED against live: the live twin has no issue operation built (MISA's integration documentation is not readable; it refuses
 * `not_available`), so the rejected refusal and the unknown-outcome error are the generic provider shapes, and whether live MISA applies
 * an unanswered issue is open (MISA-3 says no, MISA-6 says yes). A second issue of the same draft issues a second invoice (no dedupe).
 */
export class MisaMeinvoiceSandboxInvoiceService implements InvoiceIssuePort {
    /** The provider key. */
    readonly provider: string = MISA_SANDBOX_PROVIDER

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Issues one invoice on a sandbox account through exactly one sandbox call, the case being the account's next case (see the class). */
    async issue(connection: ConnectionRecord, request: InvoiceIssueRequest): Promise<IssuedInvoice> {
        const plan: SandboxCallPlan<IssuedInvoice> = {
            key: request.draftId,
            answer: async (state) => {
                switch (state.nextCase) {
                    case MISA_SANDBOX_CASE.rejected:
                        throw withProof(providerRefusal(MISA_SANDBOX_PROVIDER, "rejected", "invalid buyer tax code"), "not_sent")
                    case MISA_SANDBOX_CASE.noAnswer:
                        throw providerCallFailure("unknown")
                    case MISA_SANDBOX_CASE.unavailable:
                        throw providerCallFailure("not_sent")
                    case MISA_SANDBOX_CASE.authRefused:
                        throw withProof(providerRefusal(MISA_SANDBOX_PROVIDER, "auth_refused"), "not_sent")
                    case MISA_SANDBOX_CASE.timeoutApplied:
                        await issueOnState(state, request.draftId)
                        throw providerCallFailure("unknown")
                    default:
                        return await issueOnState(state, request.draftId)
                }
            },
        }
        return await this.sandbox.call(connection, MISA_SANDBOX_ISSUE_OPERATION, request, plan)
    }
}
