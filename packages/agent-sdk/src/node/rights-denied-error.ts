/** Thrown when a node reads or writes outside its declared rights or the agent grant. */
export class RightsDeniedError extends Error {
    readonly kind: string

    constructor(kind: string) {
        super(`RIGHTS_DENIED: ${kind}`)
        this.name = "RightsDeniedError"
        this.kind = kind
    }
}
