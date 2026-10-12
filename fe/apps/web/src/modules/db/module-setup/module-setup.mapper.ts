import type { Json } from "../../../../../../../supabase/types/database.types"
import { isJson, isRecord, objectOf, rowValueSchema, toJsonObject, uuidOf } from "../modules/modules.mapper"
import type { JsonObject } from "../modules/modules.mapper"
import type {
    ContextSnapshot,
    ContextVersion,
    DraftSnapshot,
    GateEntry,
    GateEvidence,
    GateStatus,
    SetupFact,
    SetupMessage,
    SetupRevision,
    SetupSession,
} from "@/modules/installations"

const GATE_STATUSES: ReadonlyArray<GateStatus> = ["missing", "proposed", "confirmed"]
const MESSAGE_MAX = 4000
const EVIDENCE_MAX = 800
const REPLY_MAX = 1500
const CARDS_PER_TURN = 8

const text = (value: unknown): string => (typeof value === "string" ? value : "")

const toFacts = (value: unknown): Array<SetupFact> =>
    Array.isArray(value)
        ? value.flatMap((fact): Array<SetupFact> =>
              isRecord(fact) && typeof fact.key === "string" && typeof fact.text === "string"
                  ? [{ key: fact.key, text: fact.text }]
                  : [],
          )
        : []

/** The draft of a stored snapshot: its summary and facts. */
export const toDraft = (value: unknown): DraftSnapshot =>
    isRecord(value) ? { summary: text(value.summary), facts: toFacts(value.facts) } : { summary: "", facts: [] }

const toGateEntry = (value: unknown): GateEntry | null => {
    if (!isRecord(value)) return null
    const status = GATE_STATUSES.find((candidate) => candidate === value.status)
    if (status === undefined) return null
    return {
        status,
        evidence: text(value.evidence),
        ...(typeof value.confirmed_by === "string" ? { confirmed_by: value.confirmed_by } : {}),
        ...(typeof value.confirmed_at === "string" ? { confirmed_at: value.confirmed_at } : {}),
    }
}

/** The gate evidence of a stored column: every well formed entry, by gate key. */
export const toGateEvidence = (value: unknown): GateEvidence =>
    isRecord(value)
        ? Object.fromEntries(
              Object.entries(value).flatMap(([key, entry]): ReadonlyArray<readonly [string, GateEntry]> => {
                  const gate = toGateEntry(entry)
                  return gate === null ? [] : [[key, gate]]
              }),
          )
        : {}

const toSnapshot = (value: unknown): ContextSnapshot => ({
    ...toDraft(value),
    gates: isRecord(value) ? toGateEvidence(value.gates) : {},
})

/** One context version row as the readers select it. */
export type VersionRow = {
    readonly id: string
    readonly installation_id: string
    readonly version: number
    readonly snapshot: Json
    readonly applied_by: string
    readonly applied_at: string
}

/** The version a row stands for. */
export const toVersion = (row: VersionRow): ContextVersion => ({
    id: row.id,
    installationId: row.installation_id,
    version: row.version,
    snapshot: toSnapshot(row.snapshot),
    appliedBy: row.applied_by,
    appliedAt: row.applied_at,
})

/** One setup session row as the readers select it. */
export type SessionRow = {
    readonly id: string
    readonly installation_id: string
    readonly workspace_id: string
    readonly revision: number
    readonly status: string
    readonly draft_snapshot: Json
    readonly gate_evidence: Json
    readonly created_at: string
}

const statusOf = (value: string): SetupSession["status"] =>
    value === "applied" || value === "discarded" ? value : "draft"

/** The setup session a row stands for. */
export const toSession = (row: SessionRow): SetupSession => ({
    id: row.id,
    workspaceId: row.workspace_id,
    installationId: row.installation_id,
    revision: row.revision,
    status: statusOf(row.status),
    draft: toDraft(row.draft_snapshot),
    gateEvidence: toGateEvidence(row.gate_evidence),
    createdAt: row.created_at,
})

/** The history divider a session row stands for. */
export const toRevision = (row: Pick<SessionRow, "id" | "revision" | "status">): SetupRevision => ({
    id: row.id,
    revision: row.revision,
    status: statusOf(row.status),
})

/** One setup message row as the readers select it. */
export type MessageRow = {
    readonly id: string
    readonly setup_session_id: string
    readonly role: string
    readonly author: string
    readonly body: string
    readonly created_at: string
}

/** The chat message a row stands for. */
export const toMessage = (row: MessageRow): SetupMessage => ({
    id: row.id,
    setupSessionId: row.setup_session_id,
    role: row.role === "user" ? "user" : "assistant",
    author: row.author,
    body: row.body,
    createdAt: row.created_at,
})

/** What confirming, reopening or editing a gate takes. */
export type GateChange = {
    readonly gateKey: string
    readonly action: "confirm" | "reopen" | "edit"
    readonly evidence: string
}

/** The bounded schema of a gate request. */
export const gateSchema = rowValueSchema("setupSessionId", (fields): GateChange | undefined => {
    const { gateKey, action, evidence } = fields
    if (typeof gateKey !== "string" || gateKey.length > 60) return undefined
    if (action !== "confirm" && action !== "reopen" && action !== "edit") return undefined
    return { gateKey, action, evidence: typeof evidence === "string" ? evidence.trim().slice(0, EVIDENCE_MAX) : "" }
})

/** The bounded schema of a chat message: the session and the trimmed text. */
export const messageSchema = rowValueSchema("setupSessionId", (fields) => {
    const body = typeof fields.body === "string" ? fields.body.trim().slice(0, MESSAGE_MAX) : ""
    return body === "" ? undefined : body
})

/** The bounded schema of an apply request: the installation and the language of the notices. */
export const applySchema = rowValueSchema("installationId", (fields): "vi" | "en" =>
    fields.locale === "en" ? "en" : "vi",
)

/** The states of a confirm card of the setup chat. */
export type CardStatus = "proposed" | "applied" | "rejected" | "superseded"

const CARD_STATUSES: ReadonlyArray<CardStatus> = ["proposed", "applied", "rejected", "superseded"]

/** One confirm card row as the readers select it. */
export type DbCardRow = {
    readonly id: string
    readonly workspace_id: string
    readonly setup_session_id: string
    readonly source_message_id: string | null
    readonly gate_key: string
    readonly kind: string
    readonly target_key: string
    readonly payload: Json
    readonly status: string
    readonly result: Json | null
    readonly decided_by: string | null
    readonly created_at: string
}

/** A confirm card of the setup chat, its payload still plain data. */
export type SetupCardRow = {
    readonly id: string
    readonly workspaceId: string
    readonly setupSessionId: string
    readonly sourceMessageId: string | null
    readonly gateKey: string
    readonly kind: "fact" | "rule"
    readonly targetKey: string
    readonly payload: Json
    readonly status: CardStatus
    readonly result: Json | null
    readonly decidedBy: string | null
    readonly createdAt: string
}

/** The card a row stands for. */
export const toCardRow = (row: DbCardRow): SetupCardRow => ({
    id: row.id,
    workspaceId: row.workspace_id,
    setupSessionId: row.setup_session_id,
    sourceMessageId: row.source_message_id,
    gateKey: row.gate_key,
    kind: row.kind === "rule" ? "rule" : "fact",
    targetKey: row.target_key,
    payload: row.payload,
    status: CARD_STATUSES.find((status) => status === row.status) ?? "proposed",
    result: row.result,
    decidedBy: row.decided_by,
    createdAt: row.created_at,
})

/** What one setup turn produced: the reply of NIVO and the draft and gate evidence it left. */
export type TurnInput = {
    readonly reply: string
    readonly draft: DraftSnapshot
    readonly gates: GateEvidence
}

/** The bounded schema of one stored turn. */
export const turnSchema = rowValueSchema("setupSessionId", (fields): TurnInput | undefined =>
    typeof fields.reply === "string"
        ? { reply: fields.reply.slice(0, REPLY_MAX), draft: toDraft(fields.draft), gates: toGateEvidence(fields.gates) }
        : undefined,
)

/** One card a turn proposes, before it is stored. */
export type ProposedCard = {
    readonly gateKey: string
    readonly kind: "fact" | "rule"
    readonly targetKey: string
    readonly payload: JsonObject
}

/** What storing the cards of a turn takes: the message they answer and the cards. */
export type CardsInput = {
    readonly sourceMessageId: string
    readonly cards: ReadonlyArray<ProposedCard>
}

const toProposedCard = (value: unknown): ProposedCard | null => {
    const fields = objectOf(value)
    if (fields === null || typeof fields.gateKey !== "string" || typeof fields.targetKey !== "string") return null
    if (fields.kind !== "fact" && fields.kind !== "rule") return null
    const payload = toJsonObject(fields.payload)
    if (payload === null) return null
    return {
        gateKey: fields.gateKey.slice(0, 60),
        kind: fields.kind,
        targetKey: fields.targetKey.slice(0, 300),
        payload,
    }
}

/** The bounded schema of the cards of a turn. */
export const cardsSchema = rowValueSchema("setupSessionId", (fields): CardsInput | undefined => {
    const sourceMessageId = uuidOf(fields.sourceMessageId)
    if (sourceMessageId === null || !Array.isArray(fields.cards)) return undefined
    const cards = fields.cards.slice(0, CARDS_PER_TURN).flatMap((card): Array<ProposedCard> => {
        const parsed = toProposedCard(card)
        return parsed === null ? [] : [parsed]
    })
    return { sourceMessageId, cards }
})

/** What closing a confirm card takes: how it ended and what was written. */
export type CloseCardInput = {
    readonly status: "applied" | "rejected"
    readonly payload: JsonObject
    readonly result: Json
}

/** The bounded schema of a closed card. */
export const closeCardSchema = rowValueSchema("cardId", (fields): CloseCardInput | undefined => {
    const payload = toJsonObject(fields.payload)
    const { status, result } = fields
    if (payload === null || !isJson(result)) return undefined
    return status === "applied" || status === "rejected" ? { status, payload, result } : undefined
})
