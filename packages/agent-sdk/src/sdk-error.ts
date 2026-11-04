/** The base of every error the SDK throws: a stable code beside the message. */
export class SdkError extends Error {
    /** The code. */
    readonly code: string

    constructor(code: string, message: string, cause?: unknown) {
        super(message, cause === undefined ? undefined : { cause })
        this.name = "SdkError"
        this.code = code
    }
}
