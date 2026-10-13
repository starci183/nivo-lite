import type { ConfigValue, TemplateDefinition } from "@modules/domain/automation-templates"
import { AutomationsError, AutomationsErrorCode } from "../errors/automations.error"
import type { MissingRequirement } from "../automations.contracts"
import type { PipelineRow, PipelineWrite } from "@modules/domain/automation-pipelines"
import { bodyLimit, bodyProblem, resolveConfig } from "./config.policy"

/** The wording must be at least this long. */
const BODY_MIN_LENGTH = 10

/** After this many consecutive owner approvals without edits, "send by itself" is suggested. */
export const TRUST_THRESHOLD = 20

/** A pipeline that does not exist yet: off, no wording, an empty ladder. */
export const blankPipeline = (): PipelineWrite => ({
    enabled: false,
    dismissed: false,
    config: {},
    body: null,
    bodyVersion: 0,
    basedOnContext: null,
    approvalStreak: 0,
    trustOfferedAt: null,
    autoSend: false,
})

/** The editable columns of a stored row, or a blank pipeline. */
export const writeOf = (row: PipelineRow | null): PipelineWrite =>
    row === null
        ? blankPipeline()
        : {
              enabled: row.enabled,
              dismissed: row.dismissed,
              config: row.config,
              body: row.body,
              bodyVersion: row.body_version,
              basedOnContext: row.based_on_context,
              approvalStreak: row.approval_streak,
              trustOfferedAt: row.trust_offered_at,
              autoSend: row.auto_send,
          }

/** Switches a template on or off; on needs every requirement met and stores the standard wording when the owner approved none. */
export const planToggle = (
    def: TemplateDefinition,
    current: PipelineWrite,
    enabled: boolean,
    missing: ReadonlyArray<MissingRequirement>,
    contextVersion: number | null,
): PipelineWrite => {
    if (def.executor === "definition") throw new AutomationsError({ code: AutomationsErrorCode.ComingSoon })
    if (!enabled) return { ...current, enabled }
    if (missing.length > 0) {
        throw new AutomationsError({
            code: AutomationsErrorCode.RequirementMissing,
            params: { items: missing.map((item) => item.label.vi).join(", ") },
        })
    }
    const standard = current.body === null ? def.defaultBody : null
    return {
        ...current,
        enabled,
        dismissed: false,
        config: resolveConfig(def, current.config),
        ...(standard === null ? {} : { body: standard.vi, bodyVersion: 1, basedOnContext: contextVersion }),
    }
}

const isConfigValue = (value: unknown): value is ConfigValue =>
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"

/** The values of a request that name a setting of the template and carry a text, a number or a switch. */
const pickedConfig = (values: object, editable: ReadonlySet<string>): Record<string, ConfigValue> => {
    const picked: Record<string, ConfigValue> = {}
    for (const [key, value] of Object.entries(values)) {
        if (editable.has(key) && isConfigValue(value)) picked[key] = value
    }
    return picked
}

/** What an owner saves on a template: settings, wording, or both. */
export interface SaveInput {
    /** New setting values; keys that are not settings are ignored. */
    readonly values: object | undefined
    /** The approved wording. */
    readonly body: string | undefined
}

/** The trust ladder after a decision, and whether "send by itself" is offered now. */
export interface DecisionPlan {
    /** The pipeline as it should be stored. */
    readonly write: PipelineWrite
    /** True when this decision made the offer. */
    readonly offered: boolean
}

/** Saves settings (validated and clamped) and/or the approved wording; a new wording restarts the trust ladder. */
export const planSave = (
    def: TemplateDefinition,
    current: PipelineWrite,
    input: SaveInput,
    contextVersion: number | null,
): PipelineWrite => {
    let next = current
    if (input.values !== undefined) {
        const editable = new Set(def.settings.map((setting) => setting.key))
        const picked = pickedConfig(input.values, editable)
        next = { ...next, config: resolveConfig(def, { ...current.config, ...picked }) }
    }
    if (input.body !== undefined) {
        if (def.defaultBody === null) throw new AutomationsError({ code: AutomationsErrorCode.NoMessage })
        const body = input.body.trim().slice(0, bodyLimit(def))
        const problem = bodyProblem(def, body, BODY_MIN_LENGTH)
        if (problem === "short") throw new AutomationsError({ code: AutomationsErrorCode.BodyTooShort })
        if (problem !== null) {
            throw new AutomationsError({
                code: AutomationsErrorCode.BodyUnknownVariable,
                params: { variable: problem },
            })
        }
        next = {
            ...next,
            body,
            bodyVersion: current.bodyVersion + 1,
            basedOnContext: contextVersion,
            approvalStreak: 0,
            trustOfferedAt: null,
            autoSend: false,
        }
    }
    return next
}

/** "Not for me" and its undo: a hidden template is switched off. */
export const planDismiss = (current: PipelineWrite, dismissed: boolean): PipelineWrite => ({
    ...current,
    dismissed,
    ...(dismissed ? { enabled: false } : {}),
})

/** The owner's answer to "send by itself": accepting makes the automation send by itself, declining restarts the ladder. */
export const planAutoSend = (current: PipelineWrite, accept: boolean): PipelineWrite => {
    if (current.trustOfferedAt === null) throw new AutomationsError({ code: AutomationsErrorCode.TrustNotOffered })
    return accept ? { ...current, autoSend: true } : { ...current, trustOfferedAt: null, approvalStreak: 0 }
}

/** Moves the spreadsheet automation to another Google account; the spreadsheet made with the old one is forgotten. */
export const planGoogleAccount = (
    def: TemplateDefinition,
    current: PipelineWrite,
    connectionId: string,
    known: ReadonlyArray<string>,
): PipelineWrite => {
    if (!def.requires.connections.includes("google"))
        throw new AutomationsError({ code: AutomationsErrorCode.GoogleNotUsed })
    if (!known.includes(connectionId)) throw new AutomationsError({ code: AutomationsErrorCode.GoogleAccountUnknown })
    const before = resolveConfig(def, current.config)
    return before.googleConnectionId === connectionId
        ? current
        : { ...current, config: { ...before, googleConnectionId: connectionId, spreadsheetId: "", sheetUrl: "" } }
}

/** The trust ladder after the owner decided a message of the pipeline: approvals count, anything else resets; the offer is made once. */
export const planDecision = (current: PipelineWrite, outcome: string, nowIso: string): DecisionPlan => {
    const streak = outcome === "approved" ? current.approvalStreak + 1 : 0
    const offered = streak >= TRUST_THRESHOLD && !current.autoSend && current.trustOfferedAt === null
    return {
        write: { ...current, approvalStreak: streak, trustOfferedAt: offered ? nowIso : current.trustOfferedAt },
        offered,
    }
}
