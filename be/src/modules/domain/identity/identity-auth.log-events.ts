/** Log events of the sign-in side of identity; never a token, a password or an address. */
export enum IdentityAuthLogEvent {
    /** A rotated refresh token came back, so its session was ended. */
    RefreshReuseDetected = "identity.refresh.reuse_detected",
    /** A password email could not be sent. */
    MailFailed = "identity.mail.failed",
    /** The Google round trip failed and the browser was sent back to sign in. */
    GoogleSignInFailed = "identity.google.sign_in_failed",
    /** An account was created. */
    AccountCreated = "identity.account.created",
    /** An operator account call (list, create, delete, close a principal session) failed. */
    AccountAdminFailed = "identity.account.admin_failed",
}
