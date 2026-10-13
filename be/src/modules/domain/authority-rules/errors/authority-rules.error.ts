import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the authority-rules capability. */
export enum AuthorityRulesErrorCode {
    /** The authority action is not in the registry. */
    UnknownAction = "AUTHORITY_RULES_UNKNOWN_ACTION",
}

/** How each authority-rules code travels. */
export const AUTHORITY_RULES_ERROR_KINDS: Record<AuthorityRulesErrorCode, ErrorKind> = {
    [AuthorityRulesErrorCode.UnknownAction]: "invalid",
}

/** The one error class of the authority-rules capability. */
export class AuthorityRulesError extends DomainError<AuthorityRulesErrorCode> {}
