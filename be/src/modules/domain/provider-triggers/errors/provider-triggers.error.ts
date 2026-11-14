import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the provider triggers: why reading or changing a trigger of an account was refused. */
export enum ProviderTriggersErrorCode {
    /** The provider of the account declares no trigger of that name. */
    Undeclared = "PROVIDER_TRIGGERS_UNDECLARED",
    /** The workspace has no connected account with that id. */
    UnknownAccount = "PROVIDER_TRIGGERS_UNKNOWN_ACCOUNT",
    /** Nobody decides on the trigger's events (every registered agent is told), so no decider can be bound. */
    NotDecided = "PROVIDER_TRIGGERS_NOT_DECIDED",
    /** The provider's own core path hands the account's events to an agent: that agent decides while it is bound. */
    CoreDecides = "PROVIDER_TRIGGERS_CORE_DECIDES",
    /** The agent is not attached to the account. */
    NotAttached = "PROVIDER_TRIGGERS_NOT_ATTACHED",
    /** Another declaration is already registered under the same source and trigger name (a boot error). */
    DeclarationTaken = "PROVIDER_TRIGGERS_DECLARATION_TAKEN",
    /** A delivery named a declaration that is not the one registered for its source and name. */
    DeclarationUnknown = "PROVIDER_TRIGGERS_DECLARATION_UNKNOWN",
}

/** How each provider triggers code travels. */
export const PROVIDER_TRIGGERS_ERROR_KINDS: Record<ProviderTriggersErrorCode, ErrorKind> = {
    [ProviderTriggersErrorCode.Undeclared]: "not-found",
    [ProviderTriggersErrorCode.UnknownAccount]: "not-found",
    [ProviderTriggersErrorCode.NotDecided]: "invalid",
    [ProviderTriggersErrorCode.CoreDecides]: "conflict",
    [ProviderTriggersErrorCode.NotAttached]: "invalid",
    [ProviderTriggersErrorCode.DeclarationTaken]: "conflict",
    [ProviderTriggersErrorCode.DeclarationUnknown]: "invalid",
}

/** The one error class of the provider triggers capability. */
export class ProviderTriggersError extends DomainError<ProviderTriggersErrorCode> {}
