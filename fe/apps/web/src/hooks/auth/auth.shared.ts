/** Shortest password the forms accept (the database layer enforces the same bound). */
export const PASSWORD_MIN_LENGTH = 8
/** Shortest display name a sign-up accepts. */
export const NAME_MIN_LENGTH = 2
/** Seconds before a confirmation or reset mail may be requested again. */
export const RESEND_COOLDOWN_SECONDS = 60

/** One address: a local part, one `@`, a domain with a dot. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u

/** How strong a password looks. */
export type Strength = "weak" | "ok" | "strong"

/** Rough strength hint for the sign-up and reset forms (length plus character variety). */
export const passwordStrength = (value: string): Strength => {
    const variety = [/[a-z]/u, /[A-Z]/u, /\d/u, /[^A-Za-z0-9]/u].filter((pattern) => pattern.test(value)).length
    if (value.length < PASSWORD_MIN_LENGTH || variety < 2) return "weak"
    return value.length >= 10 && variety >= 3 ? "strong" : "ok"
}

/** The catalog key of the strength sentence. */
export const strengthKey = (value: Strength): "strengthWeak" | "strengthOk" | "strengthStrong" => {
    if (value === "weak") return "strengthWeak"
    return value === "ok" ? "strengthOk" : "strengthStrong"
}

/** Catalog keys (`auth` namespace) of the friendly error sentences. */
export type AuthErrorKey =
    | "errInvalidCredentials"
    | "errEmailNotConfirmed"
    | "errTooMany"
    | "errWeakPassword"
    | "errSamePassword"
    | "errLinkInvalid"
    | "errSignupDisabled"
    | "errGeneric"

/** Maps the code of a failed database outcome (a Supabase Auth error code or HTTP status) to its catalog key. */
export const authErrorKey = (code: string): AuthErrorKey => {
    switch (code) {
        case "invalid_credentials":
            return "errInvalidCredentials"
        case "email_not_confirmed":
            return "errEmailNotConfirmed"
        case "over_request_rate_limit":
        case "over_email_send_rate_limit":
        case "over_sms_send_rate_limit":
        case "429":
            return "errTooMany"
        case "weak_password":
            return "errWeakPassword"
        case "same_password":
            return "errSamePassword"
        case "otp_expired":
        case "bad_jwt":
        case "session_not_found":
            return "errLinkInvalid"
        case "signup_disabled":
        case "email_provider_disabled":
            return "errSignupDisabled"
        default:
            return "errGeneric"
    }
}

/** Whether a failure code means the recovery link is no longer usable. */
export const isLinkInvalid = (code: string): boolean => authErrorKey(code) === "errLinkInvalid"

/** The destination for an invite token, so sign-up and sign-in lead back to the invitation page. */
export const inviteNext = (token: string | null | undefined): string | undefined =>
    token !== null && token !== undefined && /^[\w-]{6,200}$/u.test(token) ? `/invite/${token}` : undefined

/** The invite token inside a `/invite/<token>` destination. */
export const inviteOfNext = (next: string | undefined): string | undefined =>
    next?.startsWith("/invite/") === true ? next.slice("/invite/".length) : undefined
