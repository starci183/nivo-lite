import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the entity engine runtime. */
export enum EntityEngineErrorCode {
    /** The workspace the scope is entered for is not a uuid. */
    ScopeInvalid = "ENTITY_ENGINE_SCOPE_INVALID",
    /** The database refused a statement by row-level security: a bug in the engine, never a caller's fault. */
    ScopeViolation = "ENTITY_ENGINE_SCOPE_VIOLATION",
    /** A unique or exclusion constraint the declaration does not list was violated: a gap in the declaration. */
    ConstraintUndeclared = "ENTITY_ENGINE_CONSTRAINT_UNDECLARED",
    /** A serialization failure, a deadlock or a lost connection: the work may succeed when tried again. */
    Unavailable = "ENTITY_ENGINE_UNAVAILABLE",
    /** A statement failed in a way the engine does not know. */
    Failed = "ENTITY_ENGINE_FAILED",
    /** A tree names an entity the catalog does not hold. */
    EntityUnknown = "ENTITY_ENGINE_ENTITY_UNKNOWN",
    /** A query or aggregate tree has problems against the catalog. */
    QueryInvalid = "ENTITY_ENGINE_QUERY_INVALID",
    /** A mutation tree has problems against the catalog. */
    MutationInvalid = "ENTITY_ENGINE_MUTATION_INVALID",
    /** A cursor is malformed, forged, or minted for another list. */
    CursorInvalid = "ENTITY_ENGINE_CURSOR_INVALID",
    /** The cursor signing key is not a 32-byte base64 value. */
    CursorKeyInvalid = "ENTITY_ENGINE_CONFIG_CURSOR_KEY_INVALID",
    /** A queued module job does not carry a workspace, a job name and an input. */
    JobPayloadInvalid = "ENTITY_ENGINE_JOB_PAYLOAD_INVALID",
    /** A queued module job names a job no module declares. */
    JobUnknown = "ENTITY_ENGINE_JOB_UNKNOWN",
    /** The input of a queued module job does not parse against the job's declaration. */
    JobInputInvalid = "ENTITY_ENGINE_JOB_INPUT_INVALID",
    /** A job or action asks for a port the engine does not provide. */
    PortUnprovided = "ENTITY_ENGINE_PORT_UNPROVIDED",
}

/** How each entity engine code travels. */
export const ENTITY_ENGINE_ERROR_KINDS: Record<EntityEngineErrorCode, ErrorKind> = {
    [EntityEngineErrorCode.ScopeInvalid]: "invalid",
    [EntityEngineErrorCode.ScopeViolation]: "forbidden",
    [EntityEngineErrorCode.ConstraintUndeclared]: "conflict",
    [EntityEngineErrorCode.Unavailable]: "unavailable",
    [EntityEngineErrorCode.Failed]: "internal",
    [EntityEngineErrorCode.EntityUnknown]: "internal",
    [EntityEngineErrorCode.QueryInvalid]: "invalid",
    [EntityEngineErrorCode.MutationInvalid]: "invalid",
    [EntityEngineErrorCode.CursorInvalid]: "invalid",
    [EntityEngineErrorCode.CursorKeyInvalid]: "internal",
    [EntityEngineErrorCode.JobPayloadInvalid]: "invalid",
    [EntityEngineErrorCode.JobUnknown]: "internal",
    [EntityEngineErrorCode.JobInputInvalid]: "invalid",
    [EntityEngineErrorCode.PortUnprovided]: "internal",
}

/** The one error class of the entity engine capability. */
export class EntityEngineError extends DomainError<EntityEngineErrorCode> {}
