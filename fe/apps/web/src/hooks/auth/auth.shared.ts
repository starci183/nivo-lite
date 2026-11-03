export {
    EMAIL_PATTERN,
    NAME_MIN_LENGTH,
    PASSWORD_MIN_LENGTH,
    RESEND_COOLDOWN_SECONDS,
    authErrorKey,
    isLinkInvalid,
    passwordStrength,
    strengthKey,
} from "@starci/auth/client"
export type { AuthErrorKey, Strength } from "@starci/auth/client"

/** The destination for an invite token, so sign-up and sign-in lead back to the invitation page. */
export const inviteNext = (token: string | null | undefined): string | undefined =>
    token !== null && token !== undefined && /^[\w-]{6,200}$/u.test(token) ? `/invite/${token}` : undefined

/** The invite token inside a `/invite/<token>` destination. */
export const inviteOfNext = (next: string | undefined): string | undefined =>
    next?.startsWith("/invite/") === true ? next.slice("/invite/".length) : undefined
