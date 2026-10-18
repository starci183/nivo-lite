import { isRecord } from "@modules/platform/primitives"
import type { TemplateDefinition } from "../automation-templates.contracts"
import { AutomationTemplatesError, AutomationTemplatesErrorCode } from "../errors/automation-templates.error"

type Check = (value: unknown, whole: Record<string, unknown>) => boolean

const KEY_PATTERN = /^[a-z][a-z0-9_-]{2,60}$/
const EXECUTORS: ReadonlySet<unknown> = new Set(["implemented", "n8n", "definition"])
const CONTENT_MODES: ReadonlySet<unknown> = new Set(["fixed", "ai_per_case", "none"])
const TRIGGER_KINDS: ReadonlySet<unknown> = new Set(["event", "schedule"])
const SETTING_KINDS: ReadonlySet<unknown> = new Set(["number", "text", "email", "time", "toggle", "textarea"])
const AUDIENCES: ReadonlySet<unknown> = new Set(["owner", "customer"])

const isText = (value: unknown): boolean => typeof value === "string" && value.length > 0
const isLocalized = (value: unknown): boolean => isRecord(value) && isText(value.vi) && isText(value.en)
const isCount = (value: unknown): boolean => typeof value === "number" && Number.isInteger(value) && value >= 0
const isTextList = (value: unknown): boolean => Array.isArray(value) && value.every(isText)
const everyItem = (value: unknown, check: Check): boolean =>
    Array.isArray(value) && value.every((item: unknown) => check(item, {}))
const isScalar = (value: unknown): boolean =>
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"

const isSetting: Check = (value) =>
    isRecord(value) && isText(value.key) && SETTING_KINDS.has(value.kind) && isLocalized(value.label)

/** The fields of a template and what each must be; the first one that fails names itself in the error. */
const FIELDS: ReadonlyArray<readonly [name: string, check: Check]> = [
    ["version", isCount],
    ["position", isCount],
    ["pack", isText],
    ["executor", (value) => EXECUTORS.has(value)],
    ["moduleKey", (value) => value === null || isText(value)],
    ["icon", isText],
    ["name", isLocalized],
    ["description", isLocalized],
    [
        "trigger",
        (value) => isRecord(value) && TRIGGER_KINDS.has(value.kind) && isText(value.event) && isLocalized(value.line),
    ],
    [
        "requires",
        (value) =>
            isRecord(value) &&
            isTextList(value.modules) &&
            isTextList(value.channels) &&
            isTextList(value.connections) &&
            isTextList(value.capabilities),
    ],
    ["settings", (value) => everyItem(value, isSetting)],
    ["contentMode", (value) => CONTENT_MODES.has(value)],
    ["guardrails", (value) => everyItem(value, isLocalized)],
    ["variables", isTextList],
    ["defaultBody", (value) => value === null || isLocalized(value)],
    ["authority", (value) => isRecord(value) && (value.action === null || isText(value.action))],
    ["defaults", (value) => isRecord(value) && Object.values(value).every(isScalar)],
    [
        "n8n",
        (value, whole) =>
            whole.executor !== "n8n" || (isRecord(value) && isText(value.webhook) && AUDIENCES.has(value.audience)),
    ],
]

/** The name of the first field of raw data that is not what a template needs, or null when it is a template. */
const badFieldOf = (raw: unknown): string | null => {
    const whole = isRecord(raw) ? raw : {}
    if (!KEY_PATTERN.test(typeof whole.key === "string" ? whole.key : "")) return "key"
    return FIELDS.find(([name, check]) => !check(whole[name], whole))?.[0] ?? null
}

const isTemplate = (raw: unknown): raw is TemplateDefinition => badFieldOf(raw) === null

/** Checks that raw data (a JSON file, a database row) has the shape of a template and answers it typed; the error names the key and the first bad field. */
export const parseTemplateDefinition = (raw: unknown): TemplateDefinition => {
    if (isTemplate(raw)) return raw
    const key = isRecord(raw) && typeof raw.key === "string" ? raw.key : ""
    throw new AutomationTemplatesError({
        code: AutomationTemplatesErrorCode.DefinitionInvalid,
        params: { key: key || "?", field: String(badFieldOf(raw)) },
    })
}
