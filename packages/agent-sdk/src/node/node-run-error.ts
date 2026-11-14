import { DomainError } from "@starci/common"

/** Why the host refused or stopped a node run. */
export type NodeRunErrorCode =
    | "PARAMS_INVALID"
    | "INPUT_INVALID"
    | "OUTPUT_INVALID"
    | "EFFECT_UNDECLARED"
    | "EFFECT_UNKNOWN"
    | "EFFECT_PAYLOAD_INVALID"
    | "TOOL_UNKNOWN"
    | "TOOL_MUTATES"
    | "TOOL_ARGS_INVALID"
    | "TOOL_RESULT_INVALID"
    | "TOOL_NOT_OFFERED"

/** Thrown by the node host: a stable code and the node or effect it is about (`at`). */
export class NodeRunError extends DomainError<NodeRunErrorCode> {
    constructor(code: NodeRunErrorCode, at: string, options?: ErrorOptions) {
        super({ code, params: { at }, cause: options?.cause })
    }
}
