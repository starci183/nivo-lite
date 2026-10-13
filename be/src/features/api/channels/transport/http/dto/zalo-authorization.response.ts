/** The answer to starting a Zalo authorization. */
export class ZaloAuthorizationResponse {
    /** The Zalo permission page to open. */
    url!: string
    /** The address Zalo returns the browser to. */
    callbackUrl!: string
}
