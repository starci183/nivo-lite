/** What keeping the sign-up name takes. */
export interface SetSignupNameRequest {
    /** The address the account was created with. */
    readonly email: string
    /** The full name typed on the sign-up form. */
    readonly name: string
}
