import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the authority-rules capability. */
export enum AuthorityRulesErrorCode {
    /** The authority action is not in the registry. */
    UnknownAction = "AUTHORITY_RULES_UNKNOWN_ACTION",
    /** The unit is not one a rule can count in. */
    InvalidUnit = "AUTHORITY_RULES_INVALID_UNIT",
    /** The bands are negative, out of order, outside 0-100 for a percentage, or fractional for a count. */
    InvalidBands = "AUTHORITY_RULES_INVALID_BANDS",
    /** The approval policy is not one of any, all or sequential. */
    InvalidPolicy = "AUTHORITY_RULES_INVALID_POLICY",
    /** The time to approve is outside one minute to one week. */
    InvalidTimeout = "AUTHORITY_RULES_INVALID_TIMEOUT",
    /** The approver group names an unknown role, a malformed room key or a malformed member id. */
    InvalidGroup = "AUTHORITY_RULES_INVALID_GROUP",
    /** The agents a rule applies to are not agent ids. */
    InvalidAgents = "AUTHORITY_RULES_INVALID_AGENTS",
}

/** How each authority-rules code travels. */
export const AUTHORITY_RULES_ERROR_KINDS: Record<AuthorityRulesErrorCode, ErrorKind> = {
    [AuthorityRulesErrorCode.UnknownAction]: "invalid",
    [AuthorityRulesErrorCode.InvalidUnit]: "invalid",
    [AuthorityRulesErrorCode.InvalidBands]: "invalid",
    [AuthorityRulesErrorCode.InvalidPolicy]: "invalid",
    [AuthorityRulesErrorCode.InvalidTimeout]: "invalid",
    [AuthorityRulesErrorCode.InvalidGroup]: "invalid",
    [AuthorityRulesErrorCode.InvalidAgents]: "invalid",
}

/** The one error class of the authority-rules capability. */
export class AuthorityRulesError extends DomainError<AuthorityRulesErrorCode> {}
