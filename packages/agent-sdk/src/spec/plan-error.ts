import { SdkError } from "../sdk-error"

/** Thrown when a plan is asked of a spec that was not validated, which is a wiring bug and never a stored document. */
export class PlanError extends SdkError<"PLAN_SPEC_UNVALIDATED"> {}
