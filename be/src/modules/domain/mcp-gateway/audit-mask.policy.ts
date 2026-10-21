import { createHash } from "node:crypto"
import type { GatewayJson } from "./mcp-gateway.contracts"

/** Member names that always hold secrets (compared lower case, without underscores). */
const SECRET_NAMES: ReadonlySet<string> = new Set([
    "code",
    "password",
    "secret",
    "token",
    "apikey",
    "pin",
    "otp",
    "cardnumber",
    "accountnumber",
])
const MASK = "***"
const SUMMARY_MAX = 400

const isObject = (value: unknown): value is GatewayJson =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const isSecret = (key: string, extra: ReadonlySet<string>): boolean =>
    SECRET_NAMES.has(key.toLowerCase().replaceAll("_", "")) || extra.has(key)

const maskValue = (value: unknown, extra: ReadonlySet<string>): unknown => {
    if (Array.isArray(value)) return value.map((entry: unknown) => maskValue(entry, extra))
    if (!isObject(value)) return value
    return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, isSecret(key, extra) ? MASK : maskValue(entry, extra)]),
    )
}

/** A copy with every secret member (standard names and the tool's own) replaced by `***`, at any depth. */
export const masked = (value: GatewayJson, secretFields: ReadonlyArray<string> = []): GatewayJson =>
    Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
            key,
            isSecret(key, new Set(secretFields)) ? MASK : maskValue(entry, new Set(secretFields)),
        ]),
    )

const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical)
    if (!isObject(value)) return value
    return Object.fromEntries(
        Object.keys(value)
            .toSorted((a, b) => a.localeCompare(b))
            .map((key) => [key, canonical(value[key])]),
    )
}

/** The sha256 of the arguments with sorted keys, to match the remote server's own log. */
export const argsHashOf = (args: GatewayJson): string =>
    createHash("sha256")
        .update(JSON.stringify(canonical(args)))
        .digest("hex")

/** The masked result as one bounded line for the log. */
export const summaryOf = (value: GatewayJson, secretFields: ReadonlyArray<string> = []): string =>
    JSON.stringify(masked(value, secretFields)).slice(0, SUMMARY_MAX)
