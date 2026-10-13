/** How the SMTP connection is secured. */
export type Security = "starttls" | "tls"

/** One step of a provider guide (catalog keys of `smtpPresets`). */
interface GuideStep {
    readonly text: string
    readonly link?: { readonly label: string; readonly url: string }
}

/** One way of sending through a provider: where to connect and how the owner gets the password (words are catalog keys). */
interface SmtpMode {
    readonly id: string
    readonly label: string
    readonly when: string
    readonly host: string
    readonly port: number
    readonly security: Security
    /** The owner types the host themselves (hosting, SES region). */
    readonly hostEditable?: boolean
    /** A fixed username (Resend, SendGrid) the owner does not have to know. */
    readonly fixedUser?: string
    /** The username is the sender mailbox (Gmail, Microsoft 365, Zoho). */
    readonly userIsEmail?: boolean
    readonly passwordLabel: string
    readonly passwordHint: string
    readonly steps: ReadonlyArray<GuideStep>
    readonly cautions: ReadonlyArray<string>
}

/** A provider the SMTP wizard offers, with its ways of sending. */
export interface SmtpPreset {
    readonly id: "google_workspace" | "gmail" | "microsoft365" | "zoho" | "vn_hosting" | "relay_service"
    readonly title: string
    readonly blurb: string
    readonly modes: ReadonlyArray<SmtpMode>
}
