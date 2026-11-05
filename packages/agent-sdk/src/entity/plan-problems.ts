import type { PlanOp } from "./catalog.types"

/**
 * The code `cli entities plan` exits with when the plan holds a destructive step. The records model is designed for a
 * clean database (owner 2026-11-05: no production data), so there is no staging text: the ops carry the whole story.
 */
export const ENTITY_PLAN_DESTRUCTIVE = "ENTITY_PLAN_DESTRUCTIVE"

/** The steps that drop or narrow a partition object, or that the database contradicts (`additive: false`). */
export const destructiveOps = (ops: ReadonlyArray<PlanOp>): ReadonlyArray<PlanOp> =>
    ops.filter((planned) => !planned.additive)
