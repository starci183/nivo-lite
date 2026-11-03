import { SdkError } from "../sdk-error"

/** Thrown when a node reads or writes outside its declared rights or the agent grant. */
export class RightsDeniedError extends SdkError {
    readonly kind: string

    constructor(kind: string) {
        super("RIGHTS_DENIED", `RIGHTS_DENIED: ${kind}`)
        this.name = "RightsDeniedError"
        this.kind = kind
    }
}
