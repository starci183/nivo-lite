import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { SandboxCatalogue } from "@modules/domain/provider-sandbox"

/** The provider key the MISA meInvoice sandbox answers for. */
export const MISA_SANDBOX_PROVIDER: typeof PROVIDER.misaMeinvoice = PROVIDER.misaMeinvoice

/** The series every sandbox invoice number carries: `C26TSB/<8 digits>`. */
export const MISA_SANDBOX_SERIES = "C26TSB"

/** THE FIXED DAY every sandbox invoice is issued on (`issuedOn`; R60: the same answer on every machine, no clock). */
export const MISA_SANDBOX_CATALOGUE_DATE = "2026-11-14"

/** The operation (port method) every case below answers. */
export const MISA_SANDBOX_ISSUE_OPERATION = "issue"

/** The ids of the cases the implementation answers (it reads `state.nextCase` against them; MISA-1 is the default). */
export const MISA_SANDBOX_CASE = {
    /** MISA-1 (default): an invoice is issued and takes the account's next number. */
    issued: "MISA-1",
    /** MISA-2: MISA rejects the invoice (invalid buyer tax code). */
    rejected: "MISA-2",
    /** MISA-3: MISA never answers; the outcome is unknown and nothing was issued. */
    noAnswer: "MISA-3",
    /** MISA-4: MISA answers a server failure before anything is issued. */
    unavailable: "MISA-4",
    /** MISA-5: MISA refuses the account's credential. */
    authRefused: "MISA-5",
    /** MISA-6: the invoice is issued and numbered, then the answer is lost (unknown, the invoice exists). */
    timeoutApplied: "MISA-6",
} as const

/**
 * The hardcoded outbound cases of MISA meInvoice's sandbox (R62). All answer the port's `issue`; the account's sticky NEXT CASE picks
 * one, MISA-1 answers while nothing is picked. Numbers come from the account's state, gapless: only an issued invoice (MISA-1 or the
 * lost-answer MISA-6, whose invoice exists) takes the next number.
 */
export const MISA_MEINVOICE_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: MISA_SANDBOX_PROVIDER,
    cases: [
        {
            id: MISA_SANDBOX_CASE.issued,
            label: `An invoice is issued: it takes the account's next number (${MISA_SANDBOX_SERIES}/ and 8 digits, gapless)`,
            operation: MISA_SANDBOX_ISSUE_OPERATION,
            default: true,
        },
        {
            id: MISA_SANDBOX_CASE.rejected,
            label: "An invoice is rejected: the buyer tax code is invalid, MISA refuses (rejected, not sent), no number consumed",
            operation: MISA_SANDBOX_ISSUE_OPERATION,
        },
        {
            id: MISA_SANDBOX_CASE.noAnswer,
            label: "MISA gives no answer: the outcome is unknown (proof unknown) and nothing was issued, no number consumed",
            operation: MISA_SANDBOX_ISSUE_OPERATION,
        },
        {
            id: MISA_SANDBOX_CASE.unavailable,
            label: "MISA is unavailable: a server failure before anything is issued (not sent), no number consumed",
            operation: MISA_SANDBOX_ISSUE_OPERATION,
        },
        {
            id: MISA_SANDBOX_CASE.authRefused,
            label: "The account's credential is refused: auth refused (not sent), no number consumed",
            operation: MISA_SANDBOX_ISSUE_OPERATION,
        },
        {
            id: MISA_SANDBOX_CASE.timeoutApplied,
            label: "A timeout with the effect applied: the invoice is issued and numbered, then the answer is lost (proof unknown)",
            operation: MISA_SANDBOX_ISSUE_OPERATION,
        },
    ],
}
