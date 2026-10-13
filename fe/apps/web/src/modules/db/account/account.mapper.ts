/** The shortest display name an account may carry (the form checks the same bound in `hooks/account`). */
const NAME_MIN = 2

/** The shortest password an account may set (the form checks the same bound in `hooks/account`). */
const PASSWORD_MIN = 8

/** The longest text any account field accepts. */
const FIELD_MAX = 256

const ADDRESS = /^[^\s@]+@([^\s@]+)$/u
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

type Parsed<T> = { readonly success: true; readonly data: T } | { readonly success: false }

/** Whether the text is one local part, one `@` and a domain with a dot that has a character on each side; linear in the length. */
const isEmail = (value: string): boolean => {
    const domain = ADDRESS.exec(value)?.[1]
    if (domain === undefined) return false
    const dot = domain.indexOf(".", 1)
    return dot !== -1 && dot < domain.length - 1
}

/** A readable browser and operating system from a raw user agent; a null part is unknown. */
export interface Device {
    readonly browser: string | null
    readonly os: string | null
}

const BROWSERS: ReadonlyArray<readonly [RegExp, string]> = [
    [/Edg(?:e|A|iOS)?\//u, "Edge"],
    [/OPR\/|Opera/u, "Opera"],
    [/SamsungBrowser\//u, "Samsung Internet"],
    [/Firefox\/|FxiOS\//u, "Firefox"],
    [/CriOS\/|Chrome\//u, "Chrome"],
    [/Safari\//u, "Safari"],
    [/node|undici|curl|axios|python|go-http/iu, "API client"],
]

const SYSTEMS: ReadonlyArray<readonly [RegExp, string]> = [
    [/Windows/u, "Windows"],
    [/Android/u, "Android"],
    [/iPhone|iPad|iPod/u, "iOS"],
    [/Mac OS X|Macintosh/u, "macOS"],
    [/CrOS/u, "ChromeOS"],
    [/Linux/u, "Linux"],
]

/** Reads the browser and the system out of a user agent string. */
export const parseUserAgent = (userAgent: string | null): Device => {
    if (userAgent === null || userAgent === "") return { browser: null, os: null }
    return {
        browser: BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null,
        os: SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null,
    }
}

/** The session id (`session_id` claim) out of verified claims; null when the token carries none. */
export const sessionIdOf = (claims: Readonly<Record<string, unknown>>): string | null =>
    typeof claims.session_id === "string" ? claims.session_id : null

/** The sign-in methods the account page lists, from the identity providers of the user. */
export const providersOf = (
    identities: ReadonlyArray<{ readonly provider: string }> | null | undefined,
): Array<string> => (identities ?? []).map((identity) => identity.provider)

/** Bounds a new display name. */
export const profileInputSchema = {
    safeParse: (input: unknown): Parsed<{ readonly name: string }> => {
        if (typeof input !== "string") return { success: false }
        const name = input.trim()
        return name.length < NAME_MIN || name.length > FIELD_MAX
            ? { success: false }
            : { success: true, data: { name } }
    },
}

/** Bounds a new email address. */
export const emailInputSchema = {
    safeParse: (input: unknown): Parsed<{ readonly email: string }> => {
        if (typeof input !== "string") return { success: false }
        const email = input.trim().toLowerCase()
        return email.length > 254 || !isEmail(email) ? { success: false } : { success: true, data: { email } }
    },
}

/** The current password and the new one with its confirmation. */
export interface PasswordInput {
    readonly current: string
    readonly next: string
}

/** Bounds a password change: filled, long enough, confirmed and different from the current one. */
export const passwordInputSchema = {
    safeParse: (input: unknown): Parsed<PasswordInput> => {
        if (typeof input !== "object" || input === null) return { success: false }
        const entries = Object.entries(input)
        const field = (name: string): unknown => entries.find(([key]) => key === name)?.[1]
        const current = field("current")
        const next = field("next")
        const confirm = field("confirm")
        if (typeof current !== "string" || typeof next !== "string" || typeof confirm !== "string")
            return { success: false }
        if (current === "" || next.length < PASSWORD_MIN || next.length > FIELD_MAX) return { success: false }
        if (next !== confirm || next === current) return { success: false }
        return { success: true, data: { current, next } }
    },
}

/** Bounds a session id. */
export const sessionIdSchema = {
    safeParse: (input: unknown): Parsed<{ readonly id: string }> =>
        typeof input === "string" && UUID.test(input) ? { success: true, data: { id: input } } : { success: false },
}
