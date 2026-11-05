import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the door provider of the entity engine. */
export enum EntityEngineDoorErrorCode {
    /** A door call was made while an engine scope (a transaction) was open: a bug of the job runner, never of a caller. */
    InScope = "ENTITY_ENGINE_DOOR_IN_SCOPE",
}

/** How each door provider code travels. */
export const ENTITY_ENGINE_DOOR_ERROR_KINDS: Record<EntityEngineDoorErrorCode, ErrorKind> = {
    [EntityEngineDoorErrorCode.InScope]: "internal",
}

/** The one error class of the door provider capability. */
export class EntityEngineDoorError extends DomainError<EntityEngineDoorErrorCode> {}
