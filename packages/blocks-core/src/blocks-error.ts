/** The codes of the refusals the package throws: its fake engines say what they do not run and what the planner refuses, its fake ports say they were never to be called or that they fail, and its action specs say an action has no executor. */
export type BlocksErrorCode =
    | "FAKE_ENGINE_UNSUPPORTED"
    | "FAKE_ENGINE_QUERY_REFUSED"
    | "FAKE_PORT_UNUSED"
    | "FAKE_PORT_FAILED"
    | "ACTION_NOT_RUNNABLE"

/**
 * The base of every refusal this package throws (`starci.errorBase` of its manifest). A refusal carries a stable code and the
 * word it is about, so a caller groups it by code and never reads a sentence. The message is `<code>: <at>`.
 */
export class BlocksError<C extends string = BlocksErrorCode> extends Error {
    /** The stable code of the refusal. */
    readonly code: C
    /** What the refusal is about. */
    readonly at: string

    constructor(code: C, at: string, options?: ErrorOptions) {
        super(`${code}: ${at}`, options)
        this.name = new.target.name
        this.code = code
        this.at = at
    }
}
