import { randomBytes } from "node:crypto"

/** What a visitor sent through the form, before the blanks are taken out. */
export interface Submission {
    /** The name of the visitor. */
    readonly name: string | null
    /** The phone of the visitor. */
    readonly phone: string | null
    /** The email of the visitor. */
    readonly email: string | null
    /** What the visitor wrote. */
    readonly message: string | null
}

/** A new public key for a website intake: 24 lowercase hex characters, which name no secret and cannot be guessed from the workspace. */
export const newSiteKey = (): string => randomBytes(12).toString("hex")

/** The text of an optional field, or null when it is missing or blank. */
export const presented = (value: string | null): string | null => {
    const trimmed = value?.trim() ?? ""
    return trimmed === "" ? null : trimmed
}

/** Whether the visitor sent anything a person can answer: a phone, an email or a message. */
export const isAnswerable = (submission: Submission): boolean =>
    [submission.phone, submission.email, submission.message].some((value) => presented(value) !== null)

/** The group an input lands under before any lead exists: the phone, else the email, else the visitor, else the one input. */
export const customerKeyOf = (submission: Submission, visitor: string | null, fallback: string): string => {
    const phone = submission.phone?.replace(/\D/g, "") ?? ""
    if (phone !== "") return `phone:${phone}`
    const email = submission.email?.trim().toLowerCase() ?? ""
    if (email !== "") return `email:${email}`
    const visitorId = presented(visitor)
    return visitorId === null ? `web:${fallback}` : `web:${visitorId}`
}
