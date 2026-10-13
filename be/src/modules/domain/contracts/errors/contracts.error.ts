import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the contracts capability. */
export enum ContractsErrorCode {
    /** No lead of the workspace has the id the contract links to. */
    LeadNotFound = "CONTRACTS_LEAD_NOT_FOUND",
    /** No contract of the workspace has the requested id. */
    NotFound = "CONTRACTS_NOT_FOUND",
    /** The contract has no customer name. */
    CustomerRequired = "CONTRACTS_CUSTOMER_REQUIRED",
    /** A contract date is not a real YYYY-MM-DD day. */
    DateInvalid = "CONTRACTS_DATE_INVALID",
    /** The contract ends before it starts. */
    DatesReversed = "CONTRACTS_DATES_REVERSED",
    /** The contract status is not one of the known ones. */
    StatusInvalid = "CONTRACTS_STATUS_INVALID",
    /** The contract amount is not zero or more. */
    AmountInvalid = "CONTRACTS_AMOUNT_INVALID",
}

/** How each contracts code travels. */
export const CONTRACTS_ERROR_KINDS: Record<ContractsErrorCode, ErrorKind> = {
    [ContractsErrorCode.LeadNotFound]: "not-found",
    [ContractsErrorCode.NotFound]: "not-found",
    [ContractsErrorCode.CustomerRequired]: "invalid",
    [ContractsErrorCode.DateInvalid]: "invalid",
    [ContractsErrorCode.DatesReversed]: "invalid",
    [ContractsErrorCode.StatusInvalid]: "invalid",
    [ContractsErrorCode.AmountInvalid]: "invalid",
}

/** The one error class of the contracts capability. */
export class ContractsError extends DomainError<ContractsErrorCode> {}
