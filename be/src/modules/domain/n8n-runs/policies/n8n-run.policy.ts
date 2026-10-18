import { createHash, timingSafeEqual } from "node:crypto"
import { isRecord } from "@modules/platform/primitives"
import type { EmailRefs, EmailVariables, N8nAttachment } from "../n8n-runs.contracts"

/** How long a run token works. */
export const RUN_TOKEN_TTL_MS = 30 * 60_000

const BEARER = /^Bearer\s+(\S+)$/i
const RUN_ID = /^[0-9a-f-]{36}$/i
const TEMPLATE_KEY = /^[a-z][a-z0-9-]{2,60}$/
const VARIABLE_NAME = /^[a-z0-9_]{1,40}$/i
const FINAL: ReadonlySet<string> = new Set(["done", "failed", "skipped"])
const VALUE_MAX = 4000
const REF_MAX = 200
const RESULT_MAX = 8000
const SUMMARY_MAX = 600
const ATTACHMENTS_MAX = 2

/** The token and run id a bearer header carries, or null when it is not one or the id is not a uuid. */
export const parseBearer = (
    authorization: string | null | undefined,
): { readonly token: string; readonly runId: string } | null => {
    const token = BEARER.exec(authorization ?? "")?.[1]
    const runId = token?.split(".")[0]
    return token !== undefined && runId !== undefined && RUN_ID.test(runId) ? { token, runId } : null
}

/** The hex SHA-256 of a run token: the only form the database keeps. */
export const hashToken = (token: string): string => createHash("sha256").update(token, "utf8").digest("hex")

/** True when a presented token hashes to the stored hash (constant time). */
export const tokenMatches = (storedHash: string, token: string): boolean => {
    const stored = Buffer.from(storedHash)
    const given = Buffer.from(hashToken(token))
    return stored.length === given.length && timingSafeEqual(stored, given)
}

/** True when a template key can be an n8n workflow name. */
export const isWorkflowKey = (key: string): boolean => TEMPLATE_KEY.test(key)

/** True while a run can still be reported on: it is not finished. */
export const runIsOpen = (status: string): boolean => !FINAL.has(status)

/** The final status an n8n callback names; anything else counts as done. */
export const finalStatusOf = (value: unknown): "done" | "failed" | "skipped" =>
    value === "failed" || value === "skipped" ? value : "done"

/** The summary of a finished run: the text n8n sent, else its counters in words, else nothing. */
export const summaryOf = (summary: unknown, result: unknown, countWord: (key: string) => string): string | null => {
    if (typeof summary === "string") return summary.slice(0, SUMMARY_MAX)
    const counts = isRecord(result) && isRecord(result.counts) ? result.counts : undefined
    if (counts === undefined) return null
    const text = Object.entries(counts)
        .filter(([, count]) => typeof count === "number")
        .map(([key, count]) => `${countWord(key)}: ${String(count)}`)
        .join(" · ")
    return text.slice(0, SUMMARY_MAX) || null
}

/** The result n8n reported, or a mark that it was too big to keep. */
export const boundedResult = (result: unknown): Readonly<Record<string, unknown>> | null => {
    if (!isRecord(result)) return null
    return JSON.stringify(result).length <= RESULT_MAX ? result : { truncated: true }
}

/** The text and number values of a payload under well-formed names, text cut to a sensible length. */
export const scalars = (value: unknown): EmailVariables => {
    const out: Record<string, string | number> = {}
    if (!isRecord(value)) return out
    for (const [name, item] of Object.entries(value)) {
        if (!VARIABLE_NAME.test(name)) continue
        if (typeof item === "string") out[name] = item.slice(0, VALUE_MAX)
        else if (typeof item === "number") out[name] = item
    }
    return out
}

/** The references of a payload: text, numbers and nulls under well-formed names. */
export const refsOf = (value: unknown): EmailRefs => {
    const out: Record<string, string | number | null> = {}
    if (!isRecord(value)) return out
    for (const [name, item] of Object.entries(value)) {
        if (!VARIABLE_NAME.test(name)) continue
        if (item === null || typeof item === "number") out[name] = item
        else if (typeof item === "string") out[name] = item.slice(0, REF_MAX)
    }
    return out
}

/** At most two attachments, each with a file name and content. */
export const attachmentsOf = (value: unknown): ReadonlyArray<N8nAttachment> =>
    (Array.isArray(value) ? value : []).slice(0, ATTACHMENTS_MAX).flatMap((item: unknown) => {
        if (!isRecord(item) || typeof item.filename !== "string" || typeof item.content !== "string") return []
        return [
            {
                filename: item.filename,
                content: item.content,
                contentType: typeof item.contentType === "string" ? item.contentType : undefined,
                encoding: item.encoding === "base64" ? ("base64" as const) : ("utf8" as const),
            },
        ]
    })

/** Fills `{name}` (or `{{name}}`) from the variables; an unknown name becomes empty and control characters never survive. */
export const renderTemplate = (template: string, variables: EmailVariables): string =>
    [...template.replace(/\{\{?\s*([a-z0-9_]+)\s*\}?\}/gi, (_whole, name: string) => String(variables[name] ?? ""))]
        .filter((character) => !isControl(character))
        .join("")

/** True for the control characters a mail must not carry; tab, line feed and carriage return are allowed. */
const isControl = (character: string): boolean =>
    character <= "\u0008" ||
    character === "\u000b" ||
    character === "\u000c" ||
    (character >= "\u000e" && character <= "\u001f")

/** A subject is one line of at most `max` characters. */
export const oneLine = (text: string, max = 200): string =>
    text
        .replace(/[\r\n]+/g, " ")
        .trim()
        .slice(0, max)
