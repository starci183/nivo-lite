import { parseJsonText } from "@modules/platform/primitives"
import type { MetaSecret } from "./meta-connections.contracts"

/** True for a JSON object: every key of a sealed Meta credential is optional, so any object is one. */
const isMetaSecret = (value: unknown): value is MetaSecret =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The Meta credential kept in a sealed secret; an empty or unreadable secret is an empty credential. */
export const parseMetaSecret = (plain: string): MetaSecret => {
    const read = parseJsonText(plain)
    return read.ok && isMetaSecret(read.value) ? read.value : {}
}

/** The connection id a callback state names in its return path (`/connections?connect=meta&id=<uuid>`), or null. */
export const connectionIdOfReturn = (returnTo: string): string | null => {
    const id = new URL(returnTo, "https://local").searchParams.get("id")
    return id !== null && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id) ? id : null
}
