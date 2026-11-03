import { SdkError } from "../sdk-error"

/** Why the host refused or stopped a node run. */
export type NodeRunErrorCode =
    | "PARAMS_INVALID"
    | "INPUT_INVALID"
    | "OUTPUT_INVALID"
    | "EFFECT_UNDECLARED"
    | "EFFECT_UNKNOWN"
    | "EFFECT_PAYLOAD_INVALID"

/** Thrown by the node host: a stable code and the node or effect it is about. */
export class NodeRunError extends SdkError {
    declare readonly code: NodeRunErrorCode
    readonly at: string

    constructor(code: NodeRunErrorCode, at: string) {
        super(code, `${code}: ${at}`)
        this.name = "NodeRunError"
        this.at = at
    }
}
