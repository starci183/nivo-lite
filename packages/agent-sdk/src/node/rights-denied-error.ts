import { DomainError } from "@starci/common"

/** Thrown when a node calls a tool, or a run asks an effect, that the run's grant does not name. */
export class RightsDeniedError extends DomainError<"RIGHTS_DENIED"> {
    /** The tool or effect the node tried to reach. */
    readonly kind: string

    constructor(kind: string) {
        super({ code: "RIGHTS_DENIED", params: { at: kind } })
        this.kind = kind
    }
}
