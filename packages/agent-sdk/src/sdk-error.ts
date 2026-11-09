import { DomainError } from "@starci/common"

/**
 * The base of every refusal the SDK throws. A refusal carries a stable code and the id, key or word it is about, so a caller groups
 * and maps it by code and never reads a sentence. The message is `<code>: <at>`.
 */
export class SdkError<C extends string = string> extends DomainError<C> {
    /** The id, key or word the refusal is about. */
    readonly at: string

    constructor(code: C, at: string, options?: ErrorOptions) {
        super({ code, params: { at }, ...(options?.cause === undefined ? {} : { cause: options.cause }) })
        this.message = `${code}: ${at}`
        this.at = at
    }
}
