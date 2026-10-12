/**
 * Credential redaction for everything written to app_errors (and safe for any log line). Pure: no imports, so a script can load it.
 * Nothing secret may be stored outside connection_secrets, so every string, key and nested value is scrubbed before it is written:
 *  - keys named like a credential (token, secret, password, api key, authorization, cookie, key, private, refresh, access, ...) lose their value;
 *  - values that look like a JWT, a Telegram bot token, "Bearer/Apikey/Basic ...", `name=value` credentials in a URL or text,
 *    or a long hex / base64 run (over 32 chars) are replaced;
 *  - request headers and raw request bodies are never stored (see `safeRequestFacts`): only the size and chosen safe fields.
 */
export const REDACTED = "[redacted]";

const SECRET_KEY = /token|secret|passw|pwd|api[-_ ]?key|apikey|authori[sz]ation|auth|cookie|credential|signature|private|refresh|access|bearer|session|jwt|key|header/i;

const PATTERNS: ReadonlyArray<readonly [RegExp, string | ((m: string, ...g: string[]) => string)]> = [
  [/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, REDACTED],                                   // JWT
  [/\b(?:bot)?\d{5,}:[A-Za-z0-9_-]{30,}/g, REDACTED],                                                       // Telegram bot token
  [/\b(Bearer|Apikey|Api-Key|Basic|Token)\s+[A-Za-z0-9._~+/=-]{6,}/gi, (_m, scheme) => `${scheme} ${REDACTED}`], // Authorization values
  [/([?&;\s"']?(?:[\w-]*(?:token|secret|passw(?:or)?d|pwd|api[-_]?key|apikey|authorization|signature|credential|access|refresh|key)[\w-]*)["']?\s*[=:]\s*["']?)[^\s"'&,;}]{3,}/gi, (_m, head) => `${head}${REDACTED}`], // name=value / "name": "value"
  [/\b[0-9a-fA-F]{33,}\b/g, REDACTED],                                                                      // long hex
  [/[A-Za-z0-9+/_-]{33,}={0,2}/g, (m) => (/[a-z]/.test(m) && /[A-Z]/.test(m) && /\d/.test(m) ? REDACTED : m)], // long base64(url) run (mixed case + digit, so plain paths survive)
];

/** Scrubs credential-looking text out of one string. */
export const redactString = (input: string): string => {
  let out = input;
  for (const [re, to] of PATTERNS) out = out.replace(re, to as never);
  return out;
};

const MAX_DEPTH = 8;
const MAX_KEYS = 60;

/** Scrubs any value at any depth: secret-named keys are dropped to "[redacted]", strings are pattern-scrubbed, size is bounded. */
export const redactValue = (value: unknown, depth = 0): unknown => {
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value === "number" || typeof value === "boolean" || value === undefined) return value ?? null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (value instanceof Error) return { name: value.name, message: redactString(value.message) };
  if (Array.isArray(value)) return value.slice(0, MAX_KEYS).map((v) => redactValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
    out[k] = SECRET_KEY.test(k) ? REDACTED : redactValue(v, depth + 1);
  }
  return out;
};

/** What a webhook route may record about a request: its size and a few named safe fields, never headers or the body itself. */
export const safeRequestFacts = (bodyText: string | null | undefined, safe: Record<string, unknown> = {}): Record<string, unknown> => ({
  bodyBytes: bodyText ? new TextEncoder().encode(bodyText).length : 0,
  ...(redactValue(safe) as Record<string, unknown>),
});
