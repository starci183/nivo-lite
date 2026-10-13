import type { PipelinePatch } from "./automations.plans"

/** The command a screen asks the back end to run for a manager. */
export type CommandKind = "propose_body" | "run_now"

/** The parsed request to change one pipeline. */
export interface AutomationInput {
    readonly workspaceId: string
    readonly templateKey: string
    readonly patch: PipelinePatch
}

/** The parsed request to queue one command. */
export interface CommandInput {
    readonly workspaceId: string
    readonly kind: CommandKind
    readonly templateKey: string
}

type Parsed<T> = { readonly success: true; readonly data: T } | { readonly success: false }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const TEMPLATE_KEY = /^[a-z][a-z0-9_-]{2,60}$/u
const BODY_MAX = 5000
const VALUES_MAX = 60
const FAILED = { success: false } as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const isScalar = (value: unknown): value is string | number | boolean =>
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"

const optionalFlag = (value: unknown): { readonly ok: boolean; readonly value?: boolean } => {
    if (value === undefined) return { ok: true }
    return typeof value === "boolean" ? { ok: true, value } : { ok: false }
}

const patchOf = (raw: unknown): PipelinePatch | null => {
    if (!isRecord(raw)) return null
    const enabled = optionalFlag(raw.enabled)
    const dismissed = optionalFlag(raw.dismissed)
    const autoSend = optionalFlag(raw.autoSend)
    const bodyOk = raw.body === undefined || (typeof raw.body === "string" && raw.body.length <= BODY_MAX)
    const valuesOk =
        raw.values === undefined ||
        (isRecord(raw.values) &&
            Object.keys(raw.values).length <= VALUES_MAX &&
            Object.values(raw.values).every(isScalar))
    const accountOk =
        raw.googleConnectionId === undefined ||
        (typeof raw.googleConnectionId === "string" && UUID.test(raw.googleConnectionId))
    if (!enabled.ok || !dismissed.ok || !autoSend.ok || !bodyOk || !valuesOk || !accountOk) return null
    return {
        ...(enabled.value === undefined ? {} : { enabled: enabled.value }),
        ...(dismissed.value === undefined ? {} : { dismissed: dismissed.value }),
        ...(autoSend.value === undefined ? {} : { autoSend: autoSend.value }),
        ...(typeof raw.body === "string" ? { body: raw.body } : {}),
        ...(isRecord(raw.values) ? { values: raw.values } : {}),
        ...(typeof raw.googleConnectionId === "string" ? { googleConnectionId: raw.googleConnectionId } : {}),
    }
}

/** Bounds the request to change one pipeline before it reaches the database. */
export const parseAutomationInput = (input: unknown): Parsed<AutomationInput> => {
    if (!isRecord(input)) return FAILED
    const { workspaceId, templateKey } = input
    const patch = patchOf(input.patch)
    if (typeof workspaceId !== "string" || !UUID.test(workspaceId)) return FAILED
    if (typeof templateKey !== "string" || !TEMPLATE_KEY.test(templateKey) || patch === null) return FAILED
    return { success: true, data: { workspaceId, templateKey, patch } }
}

/** Bounds the request to queue a command before it reaches the database. */
export const parseCommandInput = (input: unknown): Parsed<CommandInput> => {
    if (!isRecord(input)) return FAILED
    const { workspaceId, kind, templateKey } = input
    if (typeof workspaceId !== "string" || !UUID.test(workspaceId)) return FAILED
    if (kind !== "propose_body" && kind !== "run_now") return FAILED
    if (typeof templateKey !== "string" || !TEMPLATE_KEY.test(templateKey)) return FAILED
    return { success: true, data: { workspaceId, kind, templateKey } }
}
