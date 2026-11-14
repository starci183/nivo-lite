import type { MutateDecideSetupCardRequest } from "@/hooks/swr"
import {
    FACT_SCOPES,
    FACT_SUBJECT_TYPES,
    type FactScope,
    type FactSubjectType,
    type SetupResolution,
    type SetupWrite,
    type SetupWriteDecision,
    type SetupWriteDecided,
    type SetupWriteWords,
    type SetupWriteStatus,
} from "@/modules/types"

const WRITE_STATUSES: ReadonlyArray<SetupWriteStatus> = ["proposed", "applied", "rejected", "superseded"]
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

const RESOLUTIONS: ReadonlyArray<SetupResolution> = ["replace", "keep", "both"]

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

const toResult = (value: unknown): SetupWrite["result"] => {
    if (!isRecord(value)) return null
    const resolution = RESOLUTIONS.find((candidate) => candidate === value.resolution)
    return { outcome: textOf(value.outcome), ...(resolution === undefined ? {} : { resolution }) }
}

const scopeOf = (value: unknown): FactScope => FACT_SCOPES.find((scope) => scope === value) ?? "internal"
const subjectTypeOf = (value: unknown): FactSubjectType => FACT_SUBJECT_TYPES.find((type) => type === value) ?? "other"

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
        const write: SetupWrite = {
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
    return null
}

/** The wire decision of the owner on one card. */
export const toCardDecision = (change: SetupWriteDecision): MutateDecideSetupCardRequest["change"] => {
    if (change.decision === "reject") return { decision: "reject" }
    return {
        decision: "confirm",
        value: change.fact?.value,
        scope: change.fact?.scope,
        subjectLabel: change.fact?.subjectLabel,
        attributeLabel: change.fact?.attributeLabel,
        resolution: change.resolution,
        situation: change.situation,
        onlyThisAgent: change.onlyThisAgent,
    }
}

/** The message key of the name of each audience a fact may be written for. */
export const WRITE_SCOPE_KEY = {
    public: "wScopePublic",
    internal: "wScopeInternal",
    restricted: "wScopeRestricted",
} as const

/** Resolves the settled card summary; proposed writes continue to show their editor. */
export const setupWriteDecidedOf = (
    write: SetupWrite,
    words: Omit<SetupWriteWords, "decidedOf">,
): SetupWriteDecided | null => {
    if (write.status === "proposed") return null
    const line = `${write.payload.subjectLabel} · ${write.payload.attributeLabel}: ${write.payload.value}`
    const rejectedLabel = write.result?.resolution === "keep" ? words.kept : words.rejected
    return {
        line,
        label: write.status === "rejected" ? rejectedLabel : words.applied,
        tone: write.status === "applied" ? "success" : "neutral",
    }
}
