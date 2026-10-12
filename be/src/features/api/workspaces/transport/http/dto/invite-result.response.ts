/** The answer to issuing, resending or copying an invitation link. */
export class InviteResultResponse {
    /** The invited address. */
    email!: string
    /** The link to accept; the raw token appears only here. */
    link!: string
    /** `invited`, `existing` or `none`. */
    delivery!: string
}
