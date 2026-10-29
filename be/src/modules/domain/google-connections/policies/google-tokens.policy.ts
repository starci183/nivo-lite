import { isRecord } from "@modules/platform/primitives"
import type { StoredGoogleTokens } from "../google-connections.contracts"

const REFRESH_MARGIN_MS = 90_000

const DRIVE_SCOPE_PATTERN = /auth\/drive(\.readonly)?(\s|$)/u

/** JSON text read, or the failure that kept it from being read. */
type JsonRead = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly cause: unknown }

const readJson = (plain: string): JsonRead => {
    try {
        const value: unknown = JSON.parse(plain)
        return { ok: true, value }
    } catch (cause) {
        return { ok: false, cause }
    }
}

/** The stored tokens of a sealed secret; whatever cannot be read answers nothing. */
export const parseTokens = (plain: string): Partial<StoredGoogleTokens> => {
    const read = readJson(plain)
    if (!read.ok || !isRecord(read.value)) return {}
    const { access_token: access, expires_at: expires } = read.value
    // Secrets sealed before the rename keep the grant under Google's own wire name; both spellings are read.
    const renewal = read.value.renewal_token ?? read.value.refresh_token
    return {
        ...(typeof access === "string" ? { access_token: access } : {}),
        ...(typeof renewal === "string" ? { renewal_token: renewal } : {}),
        ...(typeof expires === "number" ? { expires_at: expires } : {}),
    }
}

/** The stored access token while it is still good past the refresh margin, else null. */
export const freshAccessToken = (stored: Partial<StoredGoogleTokens>, now: number): string | null =>
    stored.access_token && (stored.expires_at ?? 0) - REFRESH_MARGIN_MS > now ? stored.access_token : null

/** False when Google said which scopes it granted and Drive read is not among them (the owner unticked it); true otherwise. */
export const grantsDriveRead = (scope: string | null): boolean => !scope || DRIVE_SCOPE_PATTERN.test(scope)
