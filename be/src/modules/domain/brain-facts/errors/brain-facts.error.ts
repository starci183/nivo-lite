import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the brain-facts capability. */
export enum BrainFactsErrorCode {
    /** A fact needs a subject, an attribute and a value. */
    FactIncomplete = "BRAIN_FACTS_INCOMPLETE",
    /** No fact of the workspace has the requested id. */
    FactNotFound = "BRAIN_FACTS_NOT_FOUND",
    /** The fact is not waiting for a decision. */
    NotProposed = "BRAIN_FACTS_NOT_PROPOSED",
    /** Only a proposed value can be chosen or split, not a proposal to stop using a fact. */
    NotAValue = "BRAIN_FACTS_NOT_A_VALUE",
    /** The fact is not in force. */
    NotActive = "BRAIN_FACTS_NOT_ACTIVE",
    /** Splitting a fact needs the situation the new value is for. */
    SituationRequired = "BRAIN_FACTS_SITUATION_REQUIRED",
    /** A relation joins two different facts with a known kind and a short label. */
    RelationInvalid = "BRAIN_FACTS_RELATION_INVALID",
    /** No relation of the workspace has the requested id. */
    RelationNotFound = "BRAIN_FACTS_RELATION_NOT_FOUND",
    /** The value does not read as the type of the truth it would replace (`params.problem`: not_money, not_boolean, ...). */
    ValueNotOfType = "BRAIN_FACTS_VALUE_NOT_OF_TYPE",
    /** The line is addressed to the AI ("AI hay bo qua..."): content, never a truth. */
    AddressedToAi = "BRAIN_FACTS_ADDRESSED_TO_AI",
    /** A bounded apply would take the truths in force of the workspace over the bound it was given: nothing was written. */
    InForceFull = "BRAIN_FACTS_IN_FORCE_FULL",
}

/** How each brain-facts code travels. */
export const BRAIN_FACTS_ERROR_KINDS: Record<BrainFactsErrorCode, ErrorKind> = {
    [BrainFactsErrorCode.FactIncomplete]: "invalid",
    [BrainFactsErrorCode.FactNotFound]: "not-found",
    [BrainFactsErrorCode.NotProposed]: "conflict",
    [BrainFactsErrorCode.NotAValue]: "conflict",
    [BrainFactsErrorCode.NotActive]: "conflict",
    [BrainFactsErrorCode.SituationRequired]: "invalid",
    [BrainFactsErrorCode.RelationInvalid]: "invalid",
    [BrainFactsErrorCode.RelationNotFound]: "not-found",
    [BrainFactsErrorCode.ValueNotOfType]: "invalid",
    [BrainFactsErrorCode.AddressedToAi]: "invalid",
    [BrainFactsErrorCode.InForceFull]: "conflict",
}

/** The one error class of the brain-facts capability. */
export class BrainFactsError extends DomainError<BrainFactsErrorCode> {}
