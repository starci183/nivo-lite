/** What the Meta webhook verification takes: the three hub query values. */
export interface MetaChallengeRequest {
    /** The hub mode. */
    readonly mode: string | undefined
    /** The hub verify token. */
    readonly verifyToken: string | undefined
    /** The hub challenge. */
    readonly challenge: string | undefined
}

/** What the verification answers: the challenge to echo. */
export type MetaChallengeResult = string
