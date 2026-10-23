/** What startTelegramLogin takes. */
export interface StartTelegramLoginRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection name. */
    readonly name: string
    /** The phone as typed. */
    readonly phone: string
    /** True when the owner agreed to the commitment. */
    readonly consent: boolean
    /** A pending connection to reuse. */
    readonly connectionId?: string | null | undefined
}
