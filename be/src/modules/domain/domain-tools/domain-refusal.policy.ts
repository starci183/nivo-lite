import { ToolsError, ToolsErrorCode, type RefusalClass } from "@modules/domain/tools"
import type { DomainToolRefusal } from "@modules/domain/provider-registry"

export { DOMAIN_TOOL_REFUSALS } from "@modules/domain/provider-registry"
export type { DomainToolRefusal }

/**
 * What each refusal IS (a TOTAL record): `business`, an answer about the domain or the request a node reads and goes on from;
 * `infrastructure`, what only the setup cures (an account, its key context, the app's wiring): the step freezes.
 */
export const DOMAIN_REFUSAL_CLASS: Readonly<Record<DomainToolRefusal, RefusalClass>> = {
    // The account cannot serve the purpose (its key context, no key, an operation its provider does not document): the setup.
    not_available: "infrastructure",
    // The domain or the record is not at the account: a fact about the business.
    not_found: "business",
    // The provider says it exists already: a fact.
    already_exists: "business",
    // The provider refused the request as asked: an answer about the request.
    rejected: "business",
    // The registration's contact data does not fit what the provider takes: an answer about the request.
    contacts_required: "business",
    contacts_unsupported: "business",
    // The provider refused a charged order for the account's balance, or the domain is locked at it: facts a person acts on.
    insufficient_balance: "business",
    domain_locked: "business",
    // No account holds the domain: a fact about the business.
    domain_not_held: "business",
    // No registrar is connected, or no single one selected: the setup.
    not_connected: "infrastructure",
    not_selected: "infrastructure",
}

/** The refusal a domain tool throws; the gateway turns it into a `tool_error` answer. The failure that led to it rides as its cause. */
export const domainRefusal = (reason: DomainToolRefusal, cause?: unknown): ToolsError =>
    new ToolsError({
        code: ToolsErrorCode.NativeRefused,
        params: { reason, refusalClass: DOMAIN_REFUSAL_CLASS[reason] },
        ...(cause === undefined ? {} : { cause }),
    })
