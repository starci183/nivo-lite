import { safeNextPath } from "@/modules/routes"
import { isEmail } from "../validation/validation.mapper"

const NAME_MIN = 2
const NAME_MAX = 120
const EMAIL_MAX = 254
const PASSWORD_MIN = 8
const PASSWORD_MAX = 256

/** Supabase codes (or the HTTP status) that mean "slow down". */
const RATE_LIMIT_CODES: ReadonlyArray<string> = [
    "over_request_rate_limit",
    "over_email_send_rate_limit",
    "over_sms_send_rate_limit",
    "429",
]

type Parse<T> = { readonly success: true; readonly data: T } | { readonly success: false }

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
export const isRateLimited = (code: string): boolean => RATE_LIMIT_CODES.includes(code)

/**
 * A same-origin destination, or undefined when none was given or it is not safe. The root path is the "no destination" value,
 * so it also reads as undefined.
 */
export const safeNext = (raw: string | null | undefined, origin: string): string | undefined => {
    if (raw === null || raw === undefined || raw === "") return undefined
    const path = safeNextPath(raw, origin)
    return path === "/" ? undefined : path
}

/** Bounds the fields of a sign-up request. */
export const signUpInputSchema = {
    safeParse: (input: unknown): Parse<SignUpInput> => {
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
            return { success: false }
        }
        return { success: true, data: { name, email, password, next: textOf(input, "next") } }
    },
}

/** Bounds a request that only carries an e-mail address (resend, password reset) and an optional destination. */
export const emailInputSchema = {
    safeParse: (input: unknown): Parse<EmailInput> => {
        const email = emailOf(input)
        if (email === undefined) return { success: false }
        return { success: true, data: { email, next: textOf(input, "next") } }
    },
}

/** Bounds a new password. */
export const passwordInputSchema = {
    safeParse: (input: unknown): Parse<string> => {
        const password = textOf(input, "password")
        if (password === undefined || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
            return { success: false }
        }
        return { success: true, data: password }
    },
}
