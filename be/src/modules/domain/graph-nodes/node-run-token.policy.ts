import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { parseJsonText } from "@modules/platform/primitives"
import type { NodeRunClaims, OptionalRunClaims, ToolArgs } from "./node-run-token.contracts"

const ORIGINS: ReadonlySet<unknown> = new Set(["customer", "owner", "staff", "system"])
const SCOPES: ReadonlySet<unknown> = new Set(["public", "workspace"])

const encode = (buffer: Buffer): string => buffer.toString("base64url")

const textOrNull = (value: unknown): value is string | null => value === null || typeof value === "string"

/** True when a parsed body holds every claim with its type. */
const isClaims = (value: unknown): value is NodeRunClaims => {
    if (typeof value !== "object" || value === null) return false
    const claims: Partial<Record<keyof NodeRunClaims, unknown>> = value
    return (
        typeof claims.workspaceId === "string" &&
        typeof claims.agentId === "string" &&
        typeof claims.runId === "string" &&
        textOrNull(claims.conversationId) &&
        ORIGINS.has(claims.origin) &&
        textOrNull(claims.memberId) &&
        SCOPES.has(claims.scope) &&
        typeof claims.expiresAt === "number"
    )
}

/** The claims a body text holds, or null when it is no JSON claims object. */
const claimsOf = (body: string): OptionalRunClaims => {
    const read = parseJsonText(Buffer.from(body, "base64url").toString("utf8"))
    return read.ok && isClaims(read.value) ? read.value : null
}

/** Signs run claims: base64url(JSON).base64url(HMAC-SHA256 of the body). */
export const signRunToken = (key: Buffer, claims: NodeRunClaims): string => {
    const body = encode(Buffer.from(JSON.stringify(claims)))
    return `${body}.${encode(createHmac("sha256", key).update(body).digest())}`
}

/** The claims of a token signed with `key` that has not expired at `now`; null for any other text. */
export const verifyRunToken = (key: Buffer, token: string, now: number): OptionalRunClaims => {
    const [body, signature, extra] = token.split(".")
    if (body === undefined || body === "" || signature === undefined || extra !== undefined) return null
    const expected = createHmac("sha256", key).update(body).digest()
    const given = Buffer.from(signature, "base64url")
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    const claims = claimsOf(body)
    return claims !== null && claims.expiresAt > now ? claims : null
}

/** The JSON of a value with the members of every object in name order, so equal arguments always print the same. */
const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
    if (typeof value === "object" && value !== null) {
        const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
        const members = entries.map(([name, member]) => [JSON.stringify(name), canonical(member)].join(":"))
        return ["{", members.join(","), "}"].join("")
    }
    return JSON.stringify(value) ?? "null"
}

/** The fingerprint of one tool call: the tool and its arguments, hashed, so an approval binds to exactly what the person saw. */
export const toolFingerprintOf = (tool: string, args: ToolArgs): string =>
    createHash("sha256")
        .update(`${tool}\n${canonical(args)}`)
        .digest("hex")
