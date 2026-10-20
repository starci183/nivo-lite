import type { ConfigValue, TemplateDefinition } from "@modules/domain/automation-templates"
import type { MessageVariables } from "../automations.contracts"
import type { PipelineConfig } from "@modules/domain/automation-pipelines"

const TEMPLATE_KEY = /^[a-z][a-z0-9_-]{2,60}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const PLACEHOLDER = /\{([a-z_]+)\}/g
const DEFAULT_TEXT_MAX = 200
const PROPOSAL_MAX = 600

/** True when the value is a template key. */
export const isTemplateKey = (value: unknown): value is string => typeof value === "string" && TEMPLATE_KEY.test(value)

const isConfigValue = (value: unknown): value is ConfigValue =>
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"

// Find address boundaries directly so long invalid domains cannot cause regex backtracking.
const normalizeEmail = (value: ConfigValue | undefined): string => {
    const email = String(value ?? "").trim()
    const at = email.indexOf("@")
    const domain = email.slice(at + 1)
    return at > 0 && !email.includes("@", at + 1) && !/\s/.test(email) && domain.slice(1, -1).includes(".")
        ? email.toLowerCase()
        : ""
}

/** The saved config over the template defaults, every setting coerced to its kind and clamped. Keys that are not settings are kept as they are. */
export const resolveConfig = (
    def: TemplateDefinition,
    saved: Readonly<Record<string, unknown>> | null | undefined,
): PipelineConfig => {
    const out: Record<string, ConfigValue> = { ...def.defaults }
    for (const [key, value] of Object.entries(saved ?? {})) if (isConfigValue(value)) out[key] = value
    for (const setting of def.settings) {
        const value = out[setting.key]
        const fallback = def.defaults[setting.key]
        if (setting.kind === "number") {
            out[setting.key] = Math.min(
                setting.max ?? Number.MAX_SAFE_INTEGER,
                Math.max(setting.min ?? 0, Math.round(Number(value) || 0)),
            )
        } else if (setting.kind === "toggle") {
            out[setting.key] = value === true || value === "true"
        } else if (setting.kind === "time") {
            out[setting.key] = HHMM.test(String(value)) ? String(value) : String(fallback ?? "00:00")
        } else if (setting.kind === "email") {
            out[setting.key] = normalizeEmail(value)
        } else {
            out[setting.key] =
                String(value ?? "")
                    .trim()
                    .slice(0, setting.maxLength ?? DEFAULT_TEXT_MAX) || String(fallback ?? "")
        }
    }
    return out
}

/** The variable names a text uses, without braces. */
export const placeholdersOf = (text: string): ReadonlySet<string> =>
    new Set(Array.from(text.matchAll(PLACEHOLDER), (match) => String(match[1])))

/**
 * Fills `{name}` blanks of a body. A blank with no value reads as the neutral word of its name (or nothing), never as a raw
 * placeholder; spaces left before punctuation are tidied.
 */
export const fillBody = (
    body: string,
    variables: MessageVariables,
    neutral: Readonly<Record<string, string>>,
): string =>
    body
        .replace(PLACEHOLDER, (_whole, name: string) => (variables[name] ?? "").trim() || (neutral[name] ?? ""))
        .replace(/[ \t]{2,}/g, " ")
        .replace(/[ \t]([.,!?])/g, "$1")
        .trim()

/** The reason a body is refused, or null when it is fine: too short, or a blank the template does not offer. */
export const bodyProblem = (def: TemplateDefinition, body: string, minLength: number): string | null => {
    if (body.length < minLength) return "short"
    return [...placeholdersOf(body)].find((name) => !def.variables.includes(name)) ?? null
}

/** The longest message a template may save: n8n bodies are whole emails. */
export const bodyLimit = (def: TemplateDefinition): number => (def.executor === "n8n" ? 4000 : PROPOSAL_MAX)

/** The model's text is usable only if it keeps every variable the frame needs, invents none, and is a single plain message. */
export const acceptableProposal = (text: string, def: TemplateDefinition, base: string): boolean => {
    if (!text || text.length > PROPOSAL_MAX || /\*\*|^#|```/m.test(text)) return false
    const have = placeholdersOf(text)
    if ([...placeholdersOf(base)].some((name) => !have.has(name))) return false
    return [...have].every((name) => def.variables.includes(name))
}

/** A text without the quotes a model wraps around it. */
export const stripQuotes = (text: string): string =>
    text
        .trim()
        .replace(/^["“”']|["“”']$/g, "")
        .trim()

/** True when a per-case message is plain text of a sensible length with no raw blank left. */
export const acceptableMessage = (text: string): boolean =>
    text.length > 0 && text.length <= 700 && !/\{[a-z_]+\}/.test(text)

/** True when a proposal is usable at all (not empty). */
export const hasText = (text: string | null): text is string => text !== null && text.length > 0
