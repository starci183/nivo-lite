/** Options of the Zalo integration. */
export interface ZaloOptions {
    /** The origin of the OAuth host, without a trailing slash. */
    readonly oauthBase: string
    /** The origin of the Open API host, without a trailing slash. */
    readonly apiBase: string
    /** The origin of the business Open API host that serves ZNS, without a trailing slash. */
    readonly businessBase: string
    /** How long one Zalo call waits for the answer. */
    readonly timeoutMs: number
}
