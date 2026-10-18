import type { GoogleOptions } from "./google.options"
import { GOOGLE_SCOPE } from "./google.contracts"

const trimSlashes = (value: string): string => {
    let end = value.length
    while (end > 0 && value[end - 1] === "/") end -= 1
    return value.slice(0, end)
}

/** The Google OAuth consent endpoint. */
export const authEndpoint = (options: Pick<GoogleOptions, "oauthBase">): string =>
    options.oauthBase
        ? `${trimSlashes(options.oauthBase)}/o/oauth2/v2/auth`
        : "https://accounts.google.com/o/oauth2/v2/auth"

/** The Google OAuth token endpoint. */
export const tokenEndpoint = (options: Pick<GoogleOptions, "oauthBase">): string =>
    options.oauthBase ? `${trimSlashes(options.oauthBase)}/token` : "https://oauth2.googleapis.com/token"

/** The OpenID userinfo endpoint. */
export const userinfoEndpoint = (options: Pick<GoogleOptions, "oauthBase">): string =>
    options.oauthBase
        ? `${trimSlashes(options.oauthBase)}/userinfo`
        : "https://openidconnect.googleapis.com/v1/userinfo"

/** The Sheets API base. */
export const sheetsBase = (options: Pick<GoogleOptions, "sheetsBase">): string =>
    trimSlashes(options.sheetsBase || "https://sheets.googleapis.com")

/** The OAuth redirect uri registered with Google, or null when the site url is unknown. */
export const redirectUri = (options: Pick<GoogleOptions, "siteUrl">): string | null =>
    options.siteUrl ? `${trimSlashes(options.siteUrl)}/api/connections/google/callback` : null

/** The consent url carrying a signed state, or null when the OAuth client or the site url is missing. */
export const buildAuthUrl = (
    options: Pick<GoogleOptions, "client" | "oauthBase" | "siteUrl">,
    state: string,
    scope: string = GOOGLE_SCOPE,
): string | null => {
    const redirect = redirectUri(options)
    if (!options.client || redirect === null) return null
    const url = new URL(authEndpoint(options))
    url.searchParams.set("client_id", options.client.clientId)
    url.searchParams.set("redirect_uri", redirect)
    url.searchParams.set("response_type", "code")
    url.searchParams.set("scope", scope)
    url.searchParams.set("access_type", "offline")
    // A workspace may connect several accounts: always let the owner pick one.
    url.searchParams.set("prompt", "select_account consent")
    url.searchParams.set("include_granted_scopes", "true")
    url.searchParams.set("state", state)
    return url.toString()
}

/** The reasons Google gives when the app is not usable for this person (not enabled, not a test user, wrong client). */
export const isConsentFailure = (code: string): boolean =>
    /^(access_denied|invalid_client|unauthorized_client|admin_policy_enforced|org_internal|disallowed_useragent|invalid_scope)$/u.test(
        code,
    )

/** The public url of a spreadsheet. */
export const sheetUrlOf = (spreadsheetId: string): string =>
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
