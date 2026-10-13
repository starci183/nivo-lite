import { createHash, randomBytes } from "node:crypto"
import type { ChannelSetupOptions } from "./channel-setup.options"

const trimSlashes = (value: string): string => value.replace(/\/+$/u, "")

/** A fresh PKCE code verifier. */
export const newZaloVerifier = (): string => randomBytes(48).toString("base64url")

/** The S256 challenge of a verifier: base64url(sha256(verifier)). */
export const challengeOf = (verifier: string): string => createHash("sha256").update(verifier).digest("base64url")

/** The callback address to register on the Zalo app: Zalo sends the browser back here with ?code&oa_id&state; null without a site url. */
export const zaloCallbackUrl = (options: Pick<ChannelSetupOptions, "siteUrl">): string | null =>
    options.siteUrl ? `${trimSlashes(options.siteUrl)}/connections/zalo/callback` : null

/** The Zalo permission url (PKCE) the owner opens to authorize the Official Account. */
export const zaloAuthorizeUrl = (
    options: Pick<ChannelSetupOptions, "zaloOauthBase">,
    appId: string,
    redirectUri: string,
    verifier: string,
    state: string,
): string => {
    const base = trimSlashes(options.zaloOauthBase || "https://oauth.zaloapp.com")
    const query = new URLSearchParams({
        app_id: appId,
        redirect_uri: redirectUri,
        code_challenge: challengeOf(verifier),
        state,
    })
    return `${base}/v4/oa/permission?${query.toString()}`
}
