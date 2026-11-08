import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the entity planner capability. */
export enum EntityPlannerErrorCode {
    /** The plan holds steps that drop or narrow something; only a contract migration may carry them. */
    PlanDestructive = "ENTITY_PLANNER_PLAN_DESTRUCTIVE",
    /** The plan could not be written as DDL. */
    RenderRefused = "ENTITY_PLANNER_RENDER_REFUSED",
    /** The same migration text is already in the migrations folder. */
    AlreadyWritten = "ENTITY_PLANNER_ALREADY_WRITTEN",
    /** `engine_catalog` answered something that is not a catalog snapshot. */
    CatalogInvalid = "ENTITY_PLANNER_CATALOG_INVALID",
    /** The database does not match the declarations. */
    PlanNotEmpty = "ENTITY_PLANNER_PLAN_NOT_EMPTY",
    /** The entities manifest file does not match the declarations. */
    ManifestMismatch = "ENTITY_PLANNER_MANIFEST_MISMATCH",
}

/** How each entity planner code travels. */
export const ENTITY_PLANNER_ERROR_KINDS: Record<EntityPlannerErrorCode, ErrorKind> = {
    [EntityPlannerErrorCode.PlanDestructive]: "conflict",
    [EntityPlannerErrorCode.RenderRefused]: "invalid",
    [EntityPlannerErrorCode.AlreadyWritten]: "conflict",
    [EntityPlannerErrorCode.CatalogInvalid]: "internal",
    [EntityPlannerErrorCode.PlanNotEmpty]: "conflict",
    [EntityPlannerErrorCode.ManifestMismatch]: "conflict",
}

/** The one error class of the entity planner capability. */
export class EntityPlannerError extends DomainError<EntityPlannerErrorCode> {}
