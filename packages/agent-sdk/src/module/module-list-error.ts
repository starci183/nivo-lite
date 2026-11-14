import { DomainError } from "@starci/common"
import type { ModuleListProblemCode } from "./module.types"

/** Thrown when a module list is refused at wiring time, so a bug in the list stops the start and never a request. */
export class ModuleListError extends DomainError<ModuleListProblemCode> {
    constructor(code: ModuleListProblemCode, at: string, options?: ErrorOptions) {
        super({ code, params: { at }, cause: options?.cause })
    }
}
