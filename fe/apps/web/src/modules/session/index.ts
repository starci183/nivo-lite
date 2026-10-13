import "server-only"
import { cookies } from "next/headers"
import { supabaseUrl } from "@/modules/config"

/** The SSR session cookie of a Supabase project is `sb-<project ref>-auth-token`, split in `.0`, `.1`... chunks when it is long. */
const authCookieBase = (): string => `sb-${new URL(supabaseUrl()).hostname.split(".")[0] ?? ""}-auth-token`

const BASE64_PREFIX = "base64-"

const decodeCookieValue = (value: string): string =>
    value.startsWith(BASE64_PREFIX)
        ? Buffer.from(value.slice(BASE64_PREFIX.length), "base64url").toString("utf8")
        : value

const accessTokenOf = (serialized: string): string | null => {
    try {
        const session: unknown = JSON.parse(decodeCookieValue(serialized))
        if (typeof session !== "object" || session === null) return null
        const token = Object.entries(session).find(([name]) => name === "access_token")?.[1]
        return typeof token === "string" ? token : null
    } catch {
        return null
    }
}

/**
 * The access token the browser presented on this request, read from the Supabase SSR auth cookie, for forwarding to the back end.
 * Nothing here trusts it: the back end verifies the signature against the project's JWKS on every call, and the proxy has already
 * refreshed an expiring token into this request's cookies. Null for an anonymous visitor.
 */
export const readAccessToken = async (): Promise<string | null> => {
    const base = authCookieBase()
    const parts = (await cookies())
        .getAll()
        .filter((cookie) => cookie.name === base || cookie.name.startsWith(`${base}.`))
        .sort((left, right) => left.name.localeCompare(right.name, "en", { numeric: true }))
    return parts.length === 0 ? null : accessTokenOf(parts.map((part) => part.value).join(""))
}
