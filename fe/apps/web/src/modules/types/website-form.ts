/** What the visitor typed into the hosted form of a shop website. */
export interface WebsiteFormValues {
    readonly name: string
    readonly phone: string
    readonly message: string
}

/** What came of the last send of the hosted form. */
export type WebsiteFormStatus = "idle" | "sending" | "sent" | "off" | "empty" | "failed"
