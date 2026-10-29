import type { HttpExchange } from "@modules/integrations/passport"

/** One cookie door of sign-in: the request and response the strategy or the refresh cookie work on. */
export interface ExchangeRequest {
    /** The request and response. */
    readonly exchange: HttpExchange
}

/** A forgotten-password or resend request. */
export interface EmailRequest {
    /** The address to mail. */
    readonly email: string
}

/** A spent emailed link. */
export interface TokenRequest {
    /** The token from the link. */
    readonly token: string
}

/** A spent password link. */
export interface ResetRequest {
    /** The token from the link. */
    readonly token: string
    /** The new password. */
    readonly password: string
}

/** A signup. */
export interface SignupRequest {
    /** The display name. */
    readonly name: string
    /** The sign-in address. */
    readonly email: string
    /** The password. */
    readonly password: string
}

/** A signed-in change of password. */
export interface ChangePasswordRequest {
    /** The current password. */
    readonly current: string
    /** The new password. */
    readonly next: string
}

/** A request with nothing in it. */
export type EmptyRequest = Record<string, never>
