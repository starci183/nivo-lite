import type { CallLogRecord } from "@modules/domain/tool-call-log"
import type { ArgConstraint, GrantMode, ToolGrantView, WorkspaceGrantView } from "@modules/domain/tool-grants"
import { parseJsonText } from "@modules/platform/primitives"
import type {
    CallLogView,
    CallOutcome,
    ToolJson,
    GrantView,
    NativeToolFamily,
    ToolGrant,
    WorkspaceToolFamily,
} from "./tools.contracts"

/** The shortest per-call limit a tool family may run under, milliseconds. */
const TIMEOUT_MIN_MS = 500
/**
 * The engine's ceiling on the limit a tool family's manifest declares, milliseconds: a family is NIVO's own code (or a provider
 * adapter's) and declares how long it may run (a speech synthesis, a video compose), up to this.
 */
export const NATIVE_TIMEOUT_CEILING_MS = 600_000
const MODES: ReadonlyArray<GrantMode> = ["auto", "ask"]
const OUTCOMES: ReadonlyArray<CallOutcome> = ["ok", "error", "refused", "approval", "timeout", "circuit_open"]

const isObject = (value: unknown): value is ToolJson =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const pick = <T extends string>(allowed: ReadonlyArray<T>, value: unknown, fallback: T): T =>
    allowed.find((entry) => entry === value) ?? fallback

const numberOrNull = (value: string | number | null): number | null => {
    if (value === null) return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/** A limit within the engine's floor and ceiling. */
const declaredTimeoutOf = (value: number): number => Math.min(NATIVE_TIMEOUT_CEILING_MS, Math.max(TIMEOUT_MIN_MS, value))

/** The mode a text names, or null when it names none (an old `never` row is no grant: nothing reads `never`). */
export const modeOf = (value: unknown): GrantMode | null => MODES.find((mode) => mode === value) ?? null

/**
 * A tool family as every workspace runs it: its manifest from code, under the limit the manifest DECLARES (up to
 * `NATIVE_TIMEOUT_CEILING_MS`: its own code knows how long it runs), else the registry's default.
 */
export const toolFamilyOf = (adapter: NativeToolFamily, defaultTimeoutMs: number): WorkspaceToolFamily => ({
    manifest: adapter.manifest,
    timeoutMs: declaredTimeoutOf(adapter.manifest.timeoutMs ?? defaultTimeoutMs),
})

/** The well-formed argument constraints of a stored list. */
export const constraintsOf = (value: unknown): ReadonlyArray<ArgConstraint> =>
    (Array.isArray(value) ? value : []).flatMap((entry: unknown) =>
        isObject(entry) && typeof entry.arg === "string" && entry.arg !== "" && typeof entry.max === "number"
            ? [{ arg: entry.arg, max: entry.max }]
            : [],
    )

/** The constraints of a JSON text; null when the text is not a JSON array. Absent text means none. */
export const constraintsOfJson = (text: string | null | undefined): ReadonlyArray<ArgConstraint> | null => {
    if (text === null || text === undefined || text.trim() === "") return []
    const parsed = parseJsonText(text)
    return parsed.ok && Array.isArray(parsed.value) ? constraintsOf(parsed.value) : null
}

/** A grant row as a grant. */
export const grantOf = (row: ToolGrantView): ToolGrant | null => {
    const mode = modeOf(row.mode)
    return mode === null
        ? null
        : { tool: row.tool, mode, limitVnd: numberOrNull(row.limit_vnd), constraints: constraintsOf(row.constraints) }
}

/** A workspace grant row as the console reads it, or null for a row whose mode is no grant (an old `never`). */
export const grantViewOf = (row: WorkspaceGrantView): GrantView | null => {
    const grant = grantOf(row)
    return grant === null
        ? null
        : { ...grant, agentId: row.agent_id, agentName: row.agent_name, constraintsJson: JSON.stringify(grant.constraints) }
}

/** An audit row as the console reads it. */
export const callLogViewOf = (row: CallLogRecord): CallLogView => ({
    id: row.id,
    tool: row.tool,
    agentName: row.agent_name,
    outcome: pick(OUTCOMES, row.outcome, "error"),
    errorCode: row.error_code,
    argsMasked: row.args_masked,
    resultSummary: row.result_summary,
    durationMs: row.duration_ms,
    approvedBy: row.approved_by,
    at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
})
