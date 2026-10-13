/** What happened to the email, as the workflow counts it. */
export class SendEmailResponse {
    /** `sent`, `waiting_decision`, `no_smtp`, `blocked`, `failed`, `rate_limited` or `duplicate`. */
    status!: string
    /** How it went out. */
    via!: string | null
    /** The work item the gate opened. */
    work_item_id!: string | null
    /** The row of the email log. */
    email_message_id!: string | null
    /** The id the mail server gave. */
    message_id!: string | null
    /** Why it did not go out. */
    error!: string | null
}
