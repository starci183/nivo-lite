import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the module-ops capability. */
export enum ModuleOpsErrorCode {
    /** The approval gate is not connected yet, so an action that needs a decision cannot be asked for. */
    GateUnavailable = "MODULE_OPS_GATE_UNAVAILABLE",
}

/** How each module-ops code travels. */
export const MODULE_OPS_ERROR_KINDS: Record<ModuleOpsErrorCode, ErrorKind> = {
    [ModuleOpsErrorCode.GateUnavailable]: "unavailable",
}

/** The one error class of the module-ops capability. */
export class ModuleOpsError extends DomainError<ModuleOpsErrorCode> {}
