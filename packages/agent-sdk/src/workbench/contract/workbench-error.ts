import type { WorkbenchProblemCode } from "./workbench.types"
import { SdkError } from "../../sdk-error"

/** The codes a workbench registration is refused with: a problem of the workbench itself, or a key two of them share. */
export type WorkbenchErrorCode = WorkbenchProblemCode | "WORKBENCH_KEY_DUPLICATE"

/** Thrown at import when a workbench is refused, so a wiring bug stops the build and never a page. */
export class WorkbenchError extends SdkError<WorkbenchErrorCode> {}
