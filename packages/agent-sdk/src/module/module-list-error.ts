import type { ModuleListProblemCode } from "./module.types"
import { SdkError } from "../sdk-error"

/** Thrown when a module list is refused at wiring time, so a bug in the list stops the start and never a request. */
export class ModuleListError extends SdkError<ModuleListProblemCode> {}
