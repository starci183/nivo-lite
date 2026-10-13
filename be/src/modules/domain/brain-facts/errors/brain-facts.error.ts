import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

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
}

/** How each brain-facts code travels. */
export const BRAIN_FACTS_ERROR_KINDS: Record<BrainFactsErrorCode, ErrorKind> = {
    [BrainFactsErrorCode.FactIncomplete]: "invalid",
    [BrainFactsErrorCode.FactNotFound]: "not-found",
    [BrainFactsErrorCode.NotProposed]: "conflict",
    [BrainFactsErrorCode.NotAValue]: "conflict",
    [BrainFactsErrorCode.NotActive]: "conflict",
    [BrainFactsErrorCode.SituationRequired]: "invalid",
}

/** The one error class of the brain-facts capability. */
export class BrainFactsError extends DomainError<BrainFactsErrorCode> {}
