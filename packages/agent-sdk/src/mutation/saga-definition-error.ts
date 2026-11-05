import { SdkError } from "../sdk-error"

/** The codes a saga definition is refused with. */
export type SagaProblemCode =
    | "SAGA_NAME_MALFORMED"
    | "SAGA_STEPS_TOO_MANY"
    | "SAGA_STEP_DUPLICATE"
    | "SAGA_COMPENSATION_SELF"
    | "SAGA_COMPENSATION_INPUT_MISMATCH"
    | "SAGA_STATE_UNKNOWN"
    | "SAGA_STATE_STATUS_MISSING"

/** Thrown at module load by `defineSaga`, with the first problem's code and the saga name or step job it is about. */
export class SagaDefinitionError extends SdkError<SagaProblemCode> {}
