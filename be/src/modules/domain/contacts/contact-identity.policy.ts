import { normaliseVnPhone } from "@modules/domain/channels/vn-phone.policy"
import type { IdentityInput, IdentityKey, NormalIdentity, OptionalIdentityValue } from "./contacts.contracts"

/** The longest identity value the store keeps (a mail address's limit). */
export const IDENTITY_VALUE_MAX = 320

/** The longest channel or account name an identity names. */
const SCOPE_MAX = 100

/** A mail address as the store compares it: one `@`, a local part and a domain, no space. A format check, never a reading of words. */
const MAIL_SHAPE = /^[^\s@]+@[^\s@]+$/u

/**
 * A phone in its ONE canonical form: the form Zalo (ZNS) takes, `84` and the nine national digits (`normaliseVnPhone` of the channels,
 * reused so a phone a channel reports and a phone a person types are the same text); null when the text cannot be such a number.
 */
export const normalisePhone = (raw: string): OptionalIdentityValue => normaliseVnPhone(raw)

/** A mail address trimmed and lower-cased; null when it has not the shape of one. */
export const normaliseEmail = (raw: string): OptionalIdentityValue => {
    const mail = raw.trim().toLowerCase()
    return mail.length <= IDENTITY_VALUE_MAX && MAIL_SHAPE.test(mail) ? mail : null
}

/** An opaque id (a channel's user id, an outside system's customer id) trimmed; null when empty or too long. Never parsed. */
const opaqueOf = (raw: string): string | null => {
    const value = raw.trim()
    return value === "" || value.length > IDENTITY_VALUE_MAX ? null : value
}

/** A channel or account name trimmed, or null when absent, empty or too long. */
const scopeOf = (raw: string | undefined): string | null => {
    const value = raw?.trim() ?? ""
    return value === "" || value.length > SCOPE_MAX ? null : value
}

/**
 * An identity in its one canonical form, or null when it cannot be one: a phone or a mail normalised and naming no channel or account; a
 * channel id with its channel (lower-cased) and its account; an outside id with its account. Verified exactly when a proof comes with it.
 */
export const normalIdentityOf = (input: IdentityInput): NormalIdentity | null => {
    const proof = input.proof ?? null
    switch (input.kind) {
        case "phone": {
            const value = normalisePhone(input.value)
            return value === null ? null : { kind: "phone", provider: "", account: "", value, proof }
        }
        case "email": {
            const value = normaliseEmail(input.value)
            return value === null ? null : { kind: "email", provider: "", account: "", value, proof }
        }
        case "channel": {
            const value = opaqueOf(input.value)
            const provider = scopeOf(input.provider)?.toLowerCase() ?? null
            const account = scopeOf(input.account)
            return value === null || provider === null || account === null
                ? null
                : { kind: "channel", provider, account, value, proof }
        }
        case "external": {
            const value = opaqueOf(input.value)
            const account = scopeOf(input.account)
            return value === null || account === null ? null : { kind: "external", provider: "", account, value, proof }
        }
    }
}

/** The one text of an identity key: what two identities are compared by, exactly. */
export const identityKeyText = (key: IdentityKey): string => `${key.kind}|${key.provider}|${key.account}|${key.value}`

/** The key of an identity, without its proof. */
export const keyOf = (identity: IdentityKey): IdentityKey => ({
    kind: identity.kind,
    provider: identity.provider,
    account: identity.account,
    value: identity.value,
})

/** The digits of a phone kept at the end when it is shown masked (`84•••••5678`). */
const PHONE_SHOWN = 4

/**
 * An identity's value as a customer-facing read shows it: a phone keeps its country code and last digits, a mail its first letter and
 * its domain, a channel or outside id is not shown at all. An internal read shows the value.
 */
export const maskedValueOf = (key: IdentityKey): string => {
    if (key.kind === "phone") return `${key.value.slice(0, 2)}${"•".repeat(Math.max(0, key.value.length - 2 - PHONE_SHOWN))}${key.value.slice(-PHONE_SHOWN)}`
    if (key.kind === "email") {
        const [local = "", domain = ""] = key.value.split("@")
        return `${local.slice(0, 1)}•••@${domain}`
    }
    return "•••"
}
