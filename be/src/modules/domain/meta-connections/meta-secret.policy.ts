import type { MetaSecret } from "./meta-connections.contracts"

/** The Meta credential kept in a sealed secret; an empty or unreadable secret is an empty credential. */
export const parseMetaSecret = (plain: string): MetaSecret => {
    try {
        const parsed: unknown = JSON.parse(plain)
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as MetaSecret) : {}
    } catch {
        return {}
    }
}

/** The connection id a callback state names in its return path (`/connections?connect=meta&id=<uuid>`), or null. */
export const connectionIdOfReturn = (returnTo: string): string | null => {
    const id = new URL(returnTo, "http://local").searchParams.get("id")
    return id !== null && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id) ? id : null
}
