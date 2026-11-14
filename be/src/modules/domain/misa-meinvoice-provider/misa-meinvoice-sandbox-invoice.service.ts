import { Injectable } from "@nestjs/common"
import { z } from "zod"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerCallFailure,
    providerRefusal,
    withProof,
    type InvoiceIssuePort,
    type InvoiceIssueRequest,
    type IssuedInvoice,
} from "@modules/domain/provider-registry"
import { ProviderSandboxService, type SandboxCallPlan, type SandboxFailure } from "@modules/domain/provider-sandbox"
import { MISA_MEINVOICE_PROVIDER } from "./misa-meinvoice-invoice.service"

/** The sandbox operation word of one invoice issue. */
const ISSUE_OPERATION = "issue"

/** The shape a fixture or script value of an issue must have: the invoice the provider would have issued. */
const issuedInvoiceSchema = z.object({
    id: z.string().min(1),
    state: z.string().min(1),
    invoiceNo: z.string().nullable(),
})

/** A stable 7-digit number of a word (FNV-1a), so one draft always gets the same invoice number. */
const stableNumberOf = (word: string): string => {
    let hash = 0x811c9dc5
    for (const char of word) {
        hash ^= char.codePointAt(0) ?? 0
        hash = Math.imul(hash, 0x01000193) >>> 0
    }
    return String(hash % 10_000_000).padStart(7, "0")
}

/** The invoice a sandbox account issues when no fixture or script names the draft: deterministic from the draft id. */
const defaultInvoiceOf = (draftId: string): IssuedInvoice => ({
    id: `sbx-inv-${draftId}`,
    state: "issued",
    invoiceNo: `SBX${stableNumberOf(draftId)}`,
})

/**
 * A scripted failure as the live adapter throws it for the same case: a refusal, an auth refusal and a missing thing prove
 * `not_sent` (the provider answered no, nothing was issued), an unavailable provider proves `not_sent` too, a timeout proves `unknown`
 * (the invoice may exist).
 */
const failureOf = (failure: SandboxFailure): Error => {
    switch (failure.kind) {
        case "refused":
            return withProof(providerRefusal(MISA_MEINVOICE_PROVIDER, "rejected", failure.reason ?? failure.detail ?? null), "not_sent")
        case "auth_expired":
            return withProof(providerRefusal(MISA_MEINVOICE_PROVIDER, "auth_refused", failure.detail ?? null), "not_sent")
        case "not_found":
            return withProof(providerRefusal(MISA_MEINVOICE_PROVIDER, "not_found", failure.detail ?? null), "not_sent")
        case "unavailable":
            return providerCallFailure("not_sent")
        case "timeout":
            return providerCallFailure("unknown")
    }
}

@Injectable()
/**
 * MISA meInvoice's SANDBOX implementation of the e-invoice issue port (owner rulings R56/R57): used when the provider account is a
 * sandbox account. It answers from the account's fixtures and scripted outcomes through the generic sandbox frame, never reaches a
 * host, and the frame logs every call. It does what a real issue would do: one call, one invoice.
 */
export class MisaMeinvoiceSandboxInvoiceService implements InvoiceIssuePort {
    /** The provider key. */
    readonly provider: string = MISA_MEINVOICE_PROVIDER

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /**
     * Issues one invoice on a sandbox account through exactly one sandbox call keyed by the draft id: a script or fixture value is
     * the invoice (a malformed one is refused `rejected`, the answer the provider's own validation gives, proving `not_sent`), else a
     * deterministic invoice of the draft.
     */
    async issue(connection: ConnectionRecord, request: InvoiceIssueRequest): Promise<IssuedInvoice> {
        const plan: SandboxCallPlan<IssuedInvoice> = {
            key: request.draftId,
            answer: (given) => {
                if (given === null) return defaultInvoiceOf(request.draftId)
                const parsed = issuedInvoiceSchema.safeParse(given)
                if (!parsed.success) {
                    throw withProof(providerRefusal(MISA_MEINVOICE_PROVIDER, "rejected", "invalid sandbox fixture"), "not_sent")
                }
                return parsed.data
            },
            fail: failureOf,
        }
        return await this.sandbox.call(connection, ISSUE_OPERATION, request, plan)
    }
}
