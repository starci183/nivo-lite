/** Log events of the account-data capability. */
export enum AccountDataLogEvent {
    /** A write named a type that is not declared, not the connection's provider's, or not written that way: a wiring error. */
    WiringRefused = "account_data.wiring_refused",
}
