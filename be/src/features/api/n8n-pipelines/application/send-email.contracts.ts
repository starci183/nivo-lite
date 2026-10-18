import type { RunAuthorization, N8nRawEmail } from "@modules/domain/n8n-runs"

/** What send email takes. */
export interface SendEmailRequest {
    /** The bearer header of the run. */
    readonly authorization: RunAuthorization
    /** The email. */
    readonly email: N8nRawEmail
}
