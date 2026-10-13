/** Log events of billing. */
export enum BillingLogEvent {
    /** A stored connection credential could not be decrypted, so its webhook is refused. */
    CredentialUnreadable = "billing.credential.unreadable",
}
