/** A contact as it was typed, or nothing. */
export type RawContact = string | null | undefined

/** The phone and the email a contact holds, both normalised; each is null when the contact is not that kind. */
export interface ContactParts {
    /** The phone as `84` digits, or null. */
    readonly phone: string | null
    /** The lowercased email, or null. */
    readonly email: string | null
}

/** Normalises a contact: a Vietnamese phone becomes `84` digits, an email is lowercased; null when empty. */
export const normaliseContact = (raw: RawContact): string | null => {
    const value = (raw ?? "").trim()
    if (value === "") return null
    if (value.includes("@")) return value.toLowerCase()
    const digits = value.replace(/\D/g, "")
    if (digits === "") return null
    if (digits.startsWith("0")) return `84${digits.slice(1)}`
    return !digits.startsWith("84") && digits.length === 9 ? `84${digits}` : digits
}

/** Splits a contact into the phone and the email it holds, so "0912 000 701" and "84912000701" match the same lead. */
export const contactParts = (raw: RawContact): ContactParts => {
    const contact = normaliseContact(raw)
    const isEmail = contact?.includes("@") === true
    return { phone: isEmail ? null : contact, email: isEmail ? contact : null }
}
