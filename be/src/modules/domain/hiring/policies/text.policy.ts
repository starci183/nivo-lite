/** The letter d with a stroke, which accent stripping leaves alone. */
const D_WITH_STROKE = new RegExp(String.fromCodePoint(0x111), "gu")

/** A mail address as the apply form accepts it. */
const EMAIL_PATTERN = /^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]{2,}$/u

/** A Vietnamese phone number once normalized: a leading zero and nine or ten more digits. */
const PHONE_PATTERN = /^0\d{9,10}$/u

/** The token of an interview or an offer link: 32 lower-case hex digits. */
const TOKEN_PATTERN = /^[a-f0-9]{32}$/u

/** Slugs that are the app's own public pages and so never a workspace slug. */
export const RESERVED_SLUGS: ReadonlyArray<string> = ["lich", "thu", "api", "admin"]

/** The longest email address. */
export const EMAIL_MAX = 254

/** Trims a typed value and cuts it to `max` characters. */
export const clip = (value: string, max: number): string => value.trim().slice(0, max)

/** Lower case, no accents, the letter d with a stroke as d. */
export const fold = (text: string): string =>
    text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(D_WITH_STROKE, "d")

/** The URL slug of a title: ascii, lower case, dashes, cut to `max` characters. */
export const slugify = (text: string, max = 60): string =>
    fold(text)
        .replace(/[^a-z0-9]+/gu, "-")
        .replace(/^-+|-+$/gu, "")
        .slice(0, max)
        .replace(/-+$/gu, "")

/** True for the token shape of an interview or offer link. */
export const isToken = (value: string): boolean => TOKEN_PATTERN.test(value)

/** True for something shaped like an email address. */
export const isEmailAddress = (value: string): boolean => EMAIL_PATTERN.test(value)

/** A Vietnamese phone number as digits with a leading zero (+84 and 84 are rewritten); null when it cannot be one. */
export const normalizePhone = (raw: string): string | null => {
    const kept = raw.replace(/[^\d+]/gu, "")
    let digits = kept
    if (kept.startsWith("+84")) digits = `0${kept.slice(3)}`
    else if (kept.startsWith("84") && kept.length >= 11) digits = `0${kept.slice(2)}`
    const plain = digits.replace(/\D/gu, "")
    return PHONE_PATTERN.test(plain) ? plain : null
}

/** The first number written in a typed answer ("1,5" and "1.5" are 1.5), or null when it has none. */
export const firstNumber = (text: string): number | null => {
    const found = /\d+(?:\.\d+)?/u.exec(text.replace(",", "."))
    return found === null ? null : Number(found[0])
}

/** A list of typed values trimmed, cut and bounded; non-text entries are dropped. */
export const cleanTextList = (value: unknown, max: number, length: number): Array<string> =>
    (Array.isArray(value) ? value : [])
        .map((entry: unknown) => (typeof entry === "string" ? clip(entry, length) : ""))
        .filter((entry) => entry !== "")
        .slice(0, max)
