/** A contact as it was typed, or nothing. */
export type RawContact = string | null | undefined

/** A contact in its stored form, or nothing. */
export type StoredContact = string | null

/** The phone and the email a contact holds, both normalised; each is null when the contact is not that kind. */
export interface ContactParts {
    /** The phone as `84` digits, or null. */
    readonly phone: string | null
    /** The lowercased email, or null. */
    readonly email: string | null
}

/** Normalises a contact: a Vietnamese phone becomes `84` digits, an email is lowercased; null when empty. */
export const normaliseContact = (raw: RawContact): StoredContact => {
    const value = (raw ?? "").trim()
    if (value === "") return null
    if (value.includes("@")) return value.toLowerCase()
    let digits = value.replace(/\D/g, "")
    if (digits === "") return null
    if (digits.startsWith("0")) digits = `84${digits.slice(1)}`
    else if (!digits.startsWith("84") && digits.length === 9) digits = `84${digits}`
    return digits
}

/** Splits a contact into the phone and the email it holds, so "0912 000 701" and "84912000701" match the same lead. */
export const contactParts = (raw: RawContact): ContactParts => {
    const contact = normaliseContact(raw)
    return {
        phone: !contact?.includes("@") ? contact : null,
        email: contact?.includes("@") ? contact : null,
    }
}
