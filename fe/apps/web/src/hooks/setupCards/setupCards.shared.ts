import { FACT_SCOPES, FACT_SUBJECT_TYPES } from "@/modules/types"
import type { FactScope, FactSubjectType, FlowRuleMode } from "@/modules/types"
import type {
    FactWrite,
    Resolution,
    RuleWrite,
    SetupWrite,
    WriteDecision,
    WriteStatus,
} from "@/lib/module-setup-writes"
import type { MutateDecideSetupCardRequest } from "@/modules/api/graphql/mutations/mutation-decide-setup-card"
import { isActionKey } from "@/modules/catalog"

const WRITE_STATUSES: ReadonlyArray<WriteStatus> = ["proposed", "applied", "rejected", "superseded"]
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

const MODES: ReadonlyArray<FlowRuleMode> = ["auto", "ask", "never"]
const RESOLUTIONS: ReadonlyArray<Resolution> = ["replace", "keep", "both"]

interface SetupCardWire {
    readonly card: {
        readonly id: string
        readonly setupSessionId: string
        readonly sourceMessageId?: string | null
        readonly gateKey: string
        readonly kind: string
        readonly status: string
        readonly payload: unknown
        readonly result?: unknown
        readonly decidedBy?: string | null
        readonly createdAt: string
    }
    readonly current?: unknown
}

const toResult = (value: unknown): FactWrite["result"] => {
    if (!isRecord(value)) return null
    const resolution = RESOLUTIONS.find((candidate) => candidate === value.resolution)
    return { outcome: textOf(value.outcome), ...(resolution === undefined ? {} : { resolution }) }
}

const scopeOf = (value: unknown): FactScope => FACT_SCOPES.find((scope) => scope === value) ?? "internal"
const subjectTypeOf = (value: unknown): FactSubjectType => FACT_SUBJECT_TYPES.find((type) => type === value) ?? "other"
const modeOf = (value: unknown): FlowRuleMode => MODES.find((mode) => mode === value) ?? "ask"
const limitOf = (value: unknown): number | null => (typeof value === "number" ? value : null)

/** One confirm card of the chat as the Setup screen draws it; none for a card whose payload names nothing the catalogue knows. */
export const toSetupWrite = (view: SetupCardWire): SetupWrite | null => {
    const { card } = view
    const payload = isRecord(card.payload) ? card.payload : {}
    const current = isRecord(view.current) ? view.current : null
    const base = {
        id: card.id,
        setupSessionId: card.setupSessionId,
        sourceMessageId: card.sourceMessageId ?? null,
        gateKey: card.gateKey,
        status: WRITE_STATUSES.find((status) => status === card.status) ?? "proposed",
        result: toResult(card.result),
        decidedBy: card.decidedBy ?? null,
        createdAt: card.createdAt,
    }
    if (card.kind === "fact") {
        const gapId = payload.gapId
        const write: FactWrite = {
            ...base,
            kind: "fact",
            payload: {
                subjectType: subjectTypeOf(payload.subjectType),
                subjectLabel: textOf(payload.subjectLabel),
                attributeLabel: textOf(payload.attributeLabel),
                value: textOf(payload.value),
                scope: scopeOf(payload.scope),
                ...(typeof gapId === "string" ? { gapId } : {}),
            },
            current:
                current === null
                    ? null
                    : {
                          value: textOf(current.value),
                          scope: scopeOf(current.scope),
                          modules: Array.isArray(current.modules) ? current.modules.map(String) : [],
                      },
        }
        return write
    }
    const action = textOf(payload.action)
    if (card.kind !== "rule" || !isActionKey(action)) return null
    const write: RuleWrite = {
        ...base,
        kind: "rule",
        payload: {
            action,
            field: payload.field === "limit_vnd" ? "limit_vnd" : "mode",
            mode: modeOf(payload.mode),
            limitVnd: limitOf(payload.limitVnd),
        },
        current: current === null ? null : { mode: modeOf(current.mode), limitVnd: limitOf(current.limitVnd) },
    }
    return write
}

/** The wire decision of the owner on one card. */
export const toCardDecision = (change: WriteDecision): MutateDecideSetupCardRequest["change"] => {
    if (change.decision === "reject") return { decision: "reject" }
    return {
        decision: "confirm",
        value: change.fact?.value,
        scope: change.fact?.scope,
        subjectLabel: change.fact?.subjectLabel,
        attributeLabel: change.fact?.attributeLabel,
        mode: change.rule?.mode,
        limitVnd: change.rule?.limitVnd,
        resolution: change.resolution,
        situation: change.situation,
        onlyThisAgent: change.onlyThisAgent,
    }
}

/** The message key of the name of each audience a fact may be written for. */
export const SCOPE_KEY = {
    public: "wScopePublic",
    internal: "wScopeInternal",
    restricted: "wScopeRestricted",
} as const
