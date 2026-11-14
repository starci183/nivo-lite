/**
 * The base of every capability error family and its guard, as `@starci/common` declares them (BE-ERROR-1): a stable code, text
 * parameters and the cause; the message is the code itself, display text is resolved from the message catalog by code.
 */
export { DomainError, isDomainError } from "@starci/common"
