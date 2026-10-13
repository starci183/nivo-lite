/**
 * Credential redaction for every log line and every stored error (app_errors). Pure, so any owner can scrub a value before it leaves
 * the process. Nothing secret may be written outside connection_secrets:
 *  - keys named like a credential (token, secret, password, api key, authorization, cookie, key, private, refresh, access, ...) lose their value;
 *  - values that look like a JWT, a Telegram bot token, "Bearer/Apikey/Basic ...", `name=value` credentials in a URL or text,
 *    or a long hex / base64 run (over 32 characters) are replaced.
 */
export const REDACTED = "[redacted]"

const SECRET_KEY =
    /token|secret|passw|pwd|api[-_ ]?key|apikey|authori[sz]ation|auth|cookie|credential|signature|private|refresh|access|bearer|session|jwt|key|header/iu

/** Keys that only name things (a template, a dedupe identity, a fencing counter) and carry no credential. */
const SAFE_KEYS: ReadonlySet<string> = new Set(["templateKey", "dedupeKey", "fencingToken", "expectedFencingToken"])

type Replacer = string | ((match: string, head: string) => string)

const PATTERNS: ReadonlyArray<readonly [RegExp, Replacer]> = [
    [/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/gu, REDACTED],
    [/\b(?:bot)?\d{5,}:[A-Za-z0-9_-]{30,}/gu, REDACTED],
    [/\b(Bearer|Apikey|Api-Key|Basic|Token)\s+[A-Za-z0-9._~+/=-]{6,}/giu, (_match, scheme) => `${scheme} ${REDACTED}`],
    [
        /([?&;\s"']?(?:[\w-]*(?:token|secret|passw(?:or)?d|pwd|api[-_]?key|apikey|authorization|signature|credential|access|refresh|key)[\w-]*)["']?\s*[=:]\s*["']?)[^\s"'&,;}]{3,}/giu,
        (_match, head) => `${head}${REDACTED}`,
    ],
    [/\b[0-9a-fA-F]{33,}\b/gu, REDACTED],
    [
        /[A-Za-z0-9+/_-]{33,}={0,2}/gu,
        (match) => (/[a-z]/u.test(match) && /[A-Z]/u.test(match) && /\d/u.test(match) ? REDACTED : match),
    ],
]

/** Scrubs credential-looking text out of one string. */
export const redactString = (input: string): string =>
    PATTERNS.reduce<string>(
        (text, [pattern, to]) =>
            typeof to === "string"
                ? text.replace(pattern, to)
                : text.replace(pattern, (match: string, head: string) => to(match, head)),
        input,
    )

const MAX_DEPTH = 8
const MAX_KEYS = 60

/** True when a key names a credential, so its value is never written. */
export const isSecretKey = (key: string): boolean => !SAFE_KEYS.has(key) && SECRET_KEY.test(key)

const walk = (value: unknown, depth: number): unknown => {
    if (typeof value === "string") return redactString(value)
    if (value === null || value === undefined) return value
    if (typeof value === "number" || typeof value === "boolean") return value
    if (typeof value === "bigint") return value.toString()
    if (typeof value === "function" || typeof value === "symbol") return undefined
    if (depth >= MAX_DEPTH) return "[truncated]"
    if (value instanceof Error) return { name: value.name, message: redactString(value.message) }
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.slice(0, MAX_KEYS).map((item: unknown) => walk(item, depth + 1))
    return scrubRecord(value, depth)
}

const scrubRecord = (record: object, depth: number): Record<string, unknown> =>
    Object.fromEntries(
        Object.entries(record)
            .slice(0, MAX_KEYS)
            .map(([key, item]) => [key, isSecretKey(key) ? REDACTED : walk(item, depth + 1)]),
    )

/** Scrubs any value at any depth: secret-named keys become "[redacted]", strings are pattern-scrubbed, size is bounded. */
export const redactValue = (value: unknown): unknown => walk(value, 0)

/** Scrubs the fields of one log line: the same rules as `redactValue`, keeping the record shape. */
export const redactFields = (fields: Readonly<Record<string, unknown>>): Record<string, unknown> =>
    scrubRecord(fields, 0)
