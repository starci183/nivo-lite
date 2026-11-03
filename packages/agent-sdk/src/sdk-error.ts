/** The base of every error the SDK throws: a stable code beside the message. */
export class SdkError extends Error {
    /** The code. */
    readonly code: string

    constructor(code: string, message: string) {
        super(message)
        this.name = "SdkError"
        this.code = code
    }
}
