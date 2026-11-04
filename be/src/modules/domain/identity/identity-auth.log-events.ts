/** Log events of the sign-in side of identity; never a token, a password or an address. */
export enum IdentityAuthLogEvent {
    /** A password email could not be sent. */
    MailFailed = "identity.mail.failed",
    /** An operator account call (list, create, delete, close a principal session) failed. */
    AccountAdminFailed = "identity.account.admin_failed",
}
