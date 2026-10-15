import { landingUrl } from "@/modules/config"

/** The destinations the sign-in, sign-up, password and invitation surfaces link to, named once. */
export const AUTH_ROUTES = {
    login: "/login",
    signup: "/signup",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
    workspaces: "/workspaces",
} as const

/** The privacy policy, served by the landing site. */
export const privacyHref = (): string => `${landingUrl()}/privacy`

/** The terms of service, served by the landing site. */
export const termsHref = (): string => `${landingUrl()}/terms`

/** The sign-in page, optionally leading on to `next` afterwards. */
export const loginPath = (next?: string): string =>
    next === undefined ? AUTH_ROUTES.login : `${AUTH_ROUTES.login}?next=${encodeURIComponent(next)}`

/** The sign-in page with the "password updated" note. */
export const loginResetPath = (): string => `${AUTH_ROUTES.login}?notice=reset`

/** The sign-up page, optionally carrying an invitation token. */
export const signupPath = (invite?: string): string =>
    invite === undefined ? AUTH_ROUTES.signup : `${AUTH_ROUTES.signup}?invite=${encodeURIComponent(invite)}`

/** The invitation page of one token. */
export const invitePath = (token: string): string => `/invite/${token}`

/** The workspaces page with the reason a person landed there. */
export const workspacesPath = (reason: "disabled" | "none"): string => `${AUTH_ROUTES.workspaces}?reason=${reason}`
