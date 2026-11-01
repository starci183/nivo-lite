import type { ZaloSetupPkce, ZaloSetupSecret } from "@modules/integrations/channel-setup"
import type { OptionalZaloSecret } from "./channel-connections.contracts"
import { parseJsonText } from "@modules/platform/primitives"

type Json = Readonly<Record<string, unknown>>

const isJson = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

const pkceOf = (value: unknown): ZaloSetupPkce | undefined => {
    if (!isJson(value)) return undefined
    const { verifier, nonce, exp } = value
    return typeof verifier === "string" && typeof nonce === "string" && typeof exp === "number"
        ? { verifier, nonce, exp }
        : undefined
}

/** The Zalo credential kept in a sealed secret, or null when the text is not one (a corrupt or foreign secret). */
export const parseZaloSecret = (plain: string): OptionalZaloSecret => {
    const read = parseJsonText(plain)
    if (!read.ok) return null
    const parsed = read.value
    if (!isJson(parsed) || typeof parsed.appId !== "string" || typeof parsed.appSecret !== "string") return null
    const pkce = pkceOf(parsed.pkce)
    const accessToken = textOf(parsed.accessToken)
    const renewalToken = textOf(parsed.renewalToken) ?? textOf(parsed.refreshToken)
    const refreshExpiresAt = textOf(parsed.refreshExpiresAt)
    return {
        appId: parsed.appId,
        appSecret: parsed.appSecret,
        oaSecret: textOf(parsed.oaSecret) ?? "",
        ...(accessToken ? { accessToken } : {}),
        ...(renewalToken ? { renewalToken } : {}),
        ...(refreshExpiresAt ? { refreshExpiresAt } : {}),
        ...(pkce ? { pkce } : {}),
    }
}

/** True when the credential holds a refresh token that has not expired at `now`. */
export const hasLiveTokens = (secret: ZaloSetupSecret, now: number): boolean => {
    if (!secret.renewalToken) return false
    if (!secret.refreshExpiresAt) return true
    const expires = Date.parse(secret.refreshExpiresAt)
    return Number.isNaN(expires) || expires > now
}
