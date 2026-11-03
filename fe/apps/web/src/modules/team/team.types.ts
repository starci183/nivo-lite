/** The latest issued invitation link and the local clipboard acknowledgement. */
export interface InviteShown {
    readonly id: string
    readonly email: string
    readonly link: string
    readonly isCopied: boolean
}
