const ADDRESS = /^[^\s@]+@([^\s@]+)$/u

/** Whether the text is one local part, one `@` and a domain with a dot that has a character on each side; linear in the length. */
const isEmail = (value: string): boolean => {
    const domain = ADDRESS.exec(value)?.[1]
    if (domain === undefined) return false
    const dot = domain.indexOf(".", 1)
    return dot !== -1 && dot < domain.length - 1
}

const NAME_MIN = 2
const NAME_MAX = 120
const EMAIL_MAX = 254
const PASSWORD_MIN = 8
const PASSWORD_MAX = 256

/** Supabase codes (or the HTTP status) that mean "slow down". */
const RATE_LIMIT_CODES: ReadonlySet<string> = new Set([
    "over_request_rate_limit",
    "over_email_send_rate_limit",
    "over_sms_send_rate_limit",
    "429",
])

/** The request-bound facts a sign-up needs. */
export interface SignUpInput {
    readonly name: string
    readonly email: string
    readonly password: string
    readonly next: string | undefined
}

/** An e-mail plus the destination to come back to. */
export interface EmailInput {
    readonly email: string
    readonly next: string | undefined
}

const fieldOf = (input: unknown, key: string): unknown =>
    typeof input === "object" && input !== null ? Object.entries(input).find(([name]) => name === key)?.[1] : undefined

const textOf = (input: unknown, key: string): string | undefined => {
    const value = fieldOf(input, key)
    return typeof value === "string" ? value : undefined
}

const emailOf = (input: unknown): string | undefined => {
    const raw = textOf(input, "email")?.trim().toLowerCase()
    return raw !== undefined && raw.length <= EMAIL_MAX && isEmail(raw) ? raw : undefined
}

/** Whether a failure code means the caller hit a rate limit. */
export const isRateLimited = (code: string): boolean => RATE_LIMIT_CODES.has(code)

/** The bounded fields of a sign-up request, or `undefined` when one is missing or out of range. */
export const parseSignUp = (input: unknown): SignUpInput | undefined => {
    const name = textOf(input, "name")?.trim()
    const email = emailOf(input)
    const password = textOf(input, "password")
    if (
        name === undefined ||
        name.length < NAME_MIN ||
        name.length > NAME_MAX ||
        email === undefined ||
        password === undefined ||
        password.length < PASSWORD_MIN ||
        password.length > PASSWORD_MAX
    ) {
        return undefined
    }
    return { name, email, password, next: textOf(input, "next") }
}

/** The bounded e-mail of a request that only carries an e-mail address (resend, password reset) and an optional destination. */
export const parseEmailRequest = (input: unknown): EmailInput | undefined => {
    const email = emailOf(input)
    return email === undefined ? undefined : { email, next: textOf(input, "next") }
}

/** The bounded new password of a request, or `undefined`. */
export const parsePassword = (input: unknown): string | undefined => {
    const password = textOf(input, "password")
    return password === undefined || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX
        ? undefined
        : password
}
