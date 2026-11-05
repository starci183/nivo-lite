import { SdkError } from "../sdk-error"

/** The codes a job definition is refused with. */
export type JobProblemCode = "JOB_NAME_MALFORMED" | "JOB_INPUT_MEMBER_INVALID" | "JOB_ATTEMPTS_INVALID"

/** Thrown at module load by `defineJob`, with the first problem's code and the job name or `<job>.<member>` it is about. */
export class JobDefinitionError extends SdkError<JobProblemCode> {}
