import { resolveConfig } from "@/lib/automation-shared"
import type { AutomationCardView, ConfigValue } from "@/lib/automation-shared"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"

/** What an owner changes on one pipeline; every field is optional. */
export interface PipelinePatch {
    readonly enabled?: boolean
    readonly dismissed?: boolean
    readonly values?: Readonly<Record<string, unknown>>
    readonly body?: string
    readonly autoSend?: boolean
    readonly googleConnectionId?: string
}

/** The columns of a pipeline one change touches; the rest stay as they are. */
export interface PipelineChange {
    readonly enabled?: boolean
    readonly dismissed?: boolean
    readonly config?: Readonly<Record<string, ConfigValue>>
    readonly body?: string
    readonly body_version?: number
    readonly based_on_context?: number | null
    readonly approval_streak?: number
    readonly trust_offered_at?: null
    readonly auto_send?: boolean
}

/** What the plan needs besides the card. */
export interface PlanContext {
    /** The context version a new wording is written from. */
    readonly contextVersion: number | null
    /** The Google connections of the workspace. */
    readonly googleIds: ReadonlyArray<string>
}

/** The lines of evidence a change writes. */
export type AuditKind = "enabled" | "disabled" | "bodySaved" | "autoSendGranted" | "autoSendDeclined"

/** A change that may be written, or the reason it may not. */
export type Planned = DbOutcome<{ readonly change: PipelineChange; readonly audits: ReadonlyArray<AuditKind> }>

const BODY_MIN_LENGTH = 10
const BODY_LIMIT = 600
const EMAIL_BODY_LIMIT = 4000
const PLACEHOLDER = /\{([a-z_]+)\}/g

const refuse = (code: string): Planned => dbFailure("invalid", code)

const isConfigValue = (value: unknown): value is ConfigValue =>
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"

const bodyProblem = (card: AutomationCardView, body: string): string | null => {
    if (body.length < BODY_MIN_LENGTH) return "AUTOMATIONS_BODY_TOO_SHORT"
    const unknown = [...body.matchAll(PLACEHOLDER)].some((match) => !card.def.variables.includes(String(match[1])))
    return unknown ? "AUTOMATIONS_BODY_UNKNOWN_VARIABLE" : null
}

/** The working copy of a pipeline while the changes of one request apply in order. */
interface Working {
    change: PipelineChange
    audits: Array<AuditKind>
    config: Readonly<Record<string, ConfigValue>>
    body: string | null
}

const dismiss = (work: Working, dismissed: boolean): void => {
    work.change = { ...work.change, dismissed, ...(dismissed ? { enabled: false } : {}) }
}

const moveAccount = (card: AutomationCardView, work: Working, id: string, context: PlanContext): string | null => {
    if (!card.def.requires.connections.includes("google")) return "AUTOMATIONS_GOOGLE_NOT_USED"
    if (!context.googleIds.includes(id)) return "AUTOMATIONS_GOOGLE_ACCOUNT_UNKNOWN"
    if (work.config.googleConnectionId === id) return null
    work.config = { ...work.config, googleConnectionId: id, spreadsheetId: "", sheetUrl: "" }
    work.change = { ...work.change, config: work.config }
    return null
}

const save = (card: AutomationCardView, work: Working, patch: PipelinePatch, context: PlanContext): string | null => {
    if (patch.values !== undefined) {
        const editable = new Set(card.def.settings.map((setting) => setting.key))
        const picked = Object.fromEntries(
            Object.entries(patch.values).filter(([key, value]) => editable.has(key) && isConfigValue(value)),
        )
        work.config = resolveConfig(card.def, { ...work.config, ...picked })
        work.change = { ...work.change, config: work.config }
    }
    if (patch.body === undefined) return null
    if (card.def.defaultBody === null) return "AUTOMATIONS_NO_MESSAGE"
    const limit = card.def.executor === "n8n" ? EMAIL_BODY_LIMIT : BODY_LIMIT
    const body = patch.body.trim().slice(0, limit)
    const problem = bodyProblem(card, body)
    if (problem !== null) return problem
    work.body = body
    work.change = {
        ...work.change,
        body,
        body_version: card.bodyVersion + 1,
        based_on_context: context.contextVersion,
        approval_streak: 0,
        trust_offered_at: null,
        auto_send: false,
    }
    work.audits.push("bodySaved")
    return null
}

const answerTrust = (card: AutomationCardView, work: Working, accept: boolean): string | null => {
    if (!card.trust.offered && !card.trust.autoSend) return "AUTOMATIONS_TRUST_NOT_OFFERED"
    work.change = accept
        ? { ...work.change, auto_send: true }
        : { ...work.change, trust_offered_at: null, approval_streak: 0 }
    work.audits.push(accept ? "autoSendGranted" : "autoSendDeclined")
    return null
}

const toggle = (card: AutomationCardView, work: Working, enabled: boolean, context: PlanContext): string | null => {
    if (card.def.executor === "definition") return "AUTOMATIONS_COMING_SOON"
    work.audits.push(enabled ? "enabled" : "disabled")
    if (!enabled) {
        work.change = { ...work.change, enabled }
        return null
    }
    if (card.missing.length > 0) return "AUTOMATIONS_REQUIREMENT_MISSING"
    const standard = work.body === null ? card.def.defaultBody : null
    work.change = {
        ...work.change,
        enabled,
        dismissed: false,
        config: resolveConfig(card.def, work.config),
        ...(standard === null ? {} : { body: standard.vi, body_version: 1, based_on_context: context.contextVersion }),
    }
    return null
}

/**
 * Applies the changes of one request in a fixed order (hide, Google account, settings and wording, send by itself, switch) on the card as
 * it stands. The first change that is not allowed ends the plan with its code.
 */
export const planChange = (card: AutomationCardView, patch: PipelinePatch, context: PlanContext): Planned => {
    if (Object.values(patch).every((value) => value === undefined)) return refuse("AUTOMATIONS_NOTHING_TO_CHANGE")
    const work: Working = { change: {}, audits: [], config: card.config, body: card.body }
    const steps: ReadonlyArray<() => string | null> = [
        () => (patch.dismissed === undefined ? null : (dismiss(work, patch.dismissed), null)),
        () =>
            patch.googleConnectionId === undefined ? null : moveAccount(card, work, patch.googleConnectionId, context),
        () => (patch.values === undefined && patch.body === undefined ? null : save(card, work, patch, context)),
        () => (patch.autoSend === undefined ? null : answerTrust(card, work, patch.autoSend)),
        () => (patch.enabled === undefined ? null : toggle(card, work, patch.enabled, context)),
    ]
    for (const step of steps) {
        const code = step()
        if (code !== null) return refuse(code)
    }
    return dbOk({ change: work.change, audits: work.audits })
}
