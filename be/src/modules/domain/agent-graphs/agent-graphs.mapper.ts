import { fieldTextOf, fieldTextOrNullOf, isRecord } from "@modules/platform/primitives"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { GraphRoad } from "@modules/domain/authority-rules"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type {
    DecisionClosedAs,
    DecisionOutcome,
    FactValue,
    GraphChangeKind,
    GraphMode,
    ProposalKind,
    ProposalStatus,
} from "./agent-graphs.contracts"
import type {
    GraphDecisionRecord,
    GraphRecord,
    PlainJson,
    ProposalRecord,
    SourceRecord,
    VersionRecord,
} from "./agent-graphs-records.contracts"

type Data = RecordRow["data"]

const GRAPH_MODES: ReadonlyArray<GraphMode> = ["shadow", "enforced"]
const CHANGE_KINDS: ReadonlyArray<GraphChangeKind> = [
    "seed",
    "chat",
    "edit",
    "conflict",
    "learned",
    "template",
    "rollback",
    "spec",
]
const PROPOSAL_KINDS: ReadonlyArray<ProposalKind> = ["conflict", "learned", "template_update", "gap", "contract"]
const PROPOSAL_STATUSES: ReadonlyArray<ProposalStatus> = ["open", "confirmed", "declined", "superseded"]
const ROADS: ReadonlyArray<GraphRoad> = ["work", "reply", "tool", "handover"]
const GATE_VERDICTS: ReadonlyArray<"auto" | "ask"> = ["auto", "ask"]
const OUTCOMES: ReadonlyArray<DecisionOutcome> = ["auto", "ask", "stop", "divert"]
const CLOSED_AS: ReadonlyArray<DecisionClosedAs> = ["done", "approved", "edited", "rejected", "expired", "stopped"]

const unreadable = (): AgentGraphsError => new AgentGraphsError({ code: AgentGraphsErrorCode.RecordUnreadable })

const textOf = (data: Data, key: string): string => {
    const value = fieldTextOf(data[key])
    if (value === undefined) throw unreadable()
    return value
}

const textOrNull = (data: Data, key: string): string | null => fieldTextOrNullOf(data[key])

const intOf = (data: Data, key: string): number => {
    const value = data[key]
    if (typeof value !== "number") throw unreadable()
    return value
}

const flagOf = (data: Data, key: string): boolean => {
    const value = data[key]
    if (typeof value !== "boolean") throw unreadable()
    return value
}

const enumOf = <T extends string>(data: Data, key: string, allowed: ReadonlyArray<T>): T => {
    const value = textOf(data, key)
    const found = allowed.find((candidate) => candidate === value)
    if (found === undefined) throw unreadable()
    return found
}

const isAbsent = (data: Data, key: string): boolean => data[key] === null || data[key] === undefined

const enumOrNull = <T extends string>(data: Data, key: string, allowed: ReadonlyArray<T>): T | null =>
    isAbsent(data, key) ? null : enumOf(data, key, allowed)

const dateOf = (data: Data, key: string): Date => new Date(textOf(data, key))

const dateOrNull = (data: Data, key: string): Date | null => (isAbsent(data, key) ? null : dateOf(data, key))

const objectOf = (data: Data, key: string): Readonly<Record<string, unknown>> => {
    const value = data[key]
    if (!isRecord(value)) throw unreadable()
    return value
}

/** The texts a record keeps under one member of a wrapping object: `{ keys: [...] }` or `{ ids: [...] }`. */
const listOf = (data: Data, key: string, member: string): ReadonlyArray<string> => {
    const list = objectOf(data, key)[member]
    if (!Array.isArray(list)) throw unreadable()
    return list.map((entry) => {
        if (typeof entry !== "string") throw unreadable()
        return entry
    })
}

const factsOf = (data: Data): Readonly<Record<string, FactValue>> =>
    Object.fromEntries(
        Object.entries(objectOf(data, "facts")).map(([key, value]) => {
            if (typeof value !== "number" && typeof value !== "string" && typeof value !== "boolean") throw unreadable()
            return [key, value]
        }),
    )

/** What every record of the engine carries: its id and its workspace. */
const headOf = (row: RecordRow): Pick<GraphRecord, "id" | "workspaceId"> => ({
    id: row.id,
    workspaceId: row.workspaceId,
})

/** What a record that is written under a fence carries besides its head: the record version and the time it was made. */
const fenceOf = (row: RecordRow): Pick<GraphRecord, "fence"> => ({ fence: row.version })

const wiringOf = (data: Data): Pick<GraphRecord, "agentId" | "installationId" | "draft" | "draftRev"> => ({
    agentId: textOf(data, "agentId"),
    installationId: textOf(data, "installationId"),
    draft: objectOf(data, "draft"),
    draftRev: intOf(data, "draftRev"),
})

const modeOf = (data: Data): Pick<GraphRecord, "activeVersionId" | "mode" | "modeSetBy" | "modeSetAt"> => ({
    activeVersionId: textOrNull(data, "activeVersionId"),
    mode: enumOf(data, "mode", GRAPH_MODES),
    modeSetBy: textOrNull(data, "modeSetBy"),
    modeSetAt: dateOrNull(data, "modeSetAt"),
})

/** A graph record read from the engine's row. */
export const graphRecordOf = (row: RecordRow): GraphRecord => ({
    ...headOf(row),
    ...fenceOf(row),
    ...wiringOf(row.data),
    ...modeOf(row.data),
})

const frozenOf = (data: Data): Pick<VersionRecord, "agentId" | "number" | "document" | "documentHash"> => ({
    agentId: textOf(data, "agentId"),
    number: intOf(data, "number"),
    document: objectOf(data, "document"),
    documentHash: textOf(data, "documentHash"),
})

const publishedOf = (
    data: Data,
): Pick<VersionRecord, "contextVersionId" | "changeKind" | "note" | "publishedBy" | "publishedAt"> => ({
    contextVersionId: textOrNull(data, "contextVersionId"),
    changeKind: enumOf(data, "changeKind", CHANGE_KINDS),
    note: textOf(data, "note"),
    publishedBy: textOrNull(data, "publishedBy"),
    publishedAt: dateOf(data, "publishedAt"),
})

/** A version record read from the engine's row. */
export const versionRecordOf = (row: RecordRow): VersionRecord => ({
    ...headOf(row),
    ...frozenOf(row.data),
    ...publishedOf(row.data),
})

const citedOf = (data: Data): Pick<SourceRecord, "versionId" | "agentId" | "nodeKey" | "branchKey"> => ({
    versionId: textOf(data, "versionId"),
    agentId: textOf(data, "agentId"),
    nodeKey: textOf(data, "nodeKey"),
    branchKey: textOf(data, "branchKey"),
})

const backedByOf = (data: Data): Pick<SourceRecord, "kind" | "ref" | "valueHash"> => ({
    kind: textOf(data, "kind"),
    ref: textOf(data, "ref"),
    valueHash: textOf(data, "valueHash"),
})

/** A source record read from the engine's row. */
export const sourceRecordOf = (row: RecordRow): SourceRecord => ({
    workspaceId: row.workspaceId,
    ...citedOf(row.data),
    ...backedByOf(row.data),
})

const raisedOf = (data: Data): Pick<ProposalRecord, "agentId" | "kind" | "status"> => ({
    agentId: textOf(data, "agentId"),
    kind: enumOf(data, "kind", PROPOSAL_KINDS),
    status: enumOf(data, "status", PROPOSAL_STATUSES),
})

const aboutOf = (data: Data): Pick<ProposalRecord, "baseVersionId" | "nodeKey" | "branchKey"> => ({
    baseVersionId: textOrNull(data, "baseVersionId"),
    nodeKey: textOrNull(data, "nodeKey"),
    branchKey: textOrNull(data, "branchKey"),
})

const changeOf = (data: Data): Pick<ProposalRecord, "patch" | "widens" | "evidence"> => ({
    patch: objectOf(data, "patch"),
    widens: flagOf(data, "widens"),
    evidence: listOf(data, "evidence", "ids"),
})

/** A proposal record read from the engine's row. */
export const proposalRecordOf = (row: RecordRow): ProposalRecord => ({
    ...headOf(row),
    ...fenceOf(row),
    createdAt: new Date(row.createdAt),
    ...raisedOf(row.data),
    ...aboutOf(row.data),
    ...changeOf(row.data),
})

const ranOf = (data: Data): Pick<GraphDecisionRecord, "agentId" | "workItemId" | "road" | "mode" | "gateVerdict"> => ({
    agentId: textOf(data, "agentId"),
    workItemId: textOrNull(data, "workItemId"),
    road: enumOf(data, "road", ROADS),
    mode: enumOf(data, "mode", GRAPH_MODES),
    gateVerdict: enumOrNull(data, "gateVerdict", GATE_VERDICTS),
})

const unjudgedOf = (data: Data): Pick<GraphDecisionRecord, "unread" | "unjudged" | "subjectType" | "subjectId"> => ({
    unread: listOf(data, "unread", "keys"),
    unjudged: textOrNull(data, "unjudged"),
    subjectType: textOrNull(data, "subjectType"),
    subjectId: textOrNull(data, "subjectId"),
})

const walkOf = (data: Data): Pick<GraphDecisionRecord, "versionId" | "wakeId" | "action" | "path"> => ({
    versionId: textOf(data, "versionId"),
    wakeId: textOrNull(data, "wakeId"),
    action: textOf(data, "action"),
    path: listOf(data, "path", "keys"),
})

const answerOf = (
    data: Data,
): Pick<GraphDecisionRecord, "facts" | "branchKey" | "outcome" | "approvalRequestId" | "closedAs" | "shadowDiff"> => ({
    facts: factsOf(data),
    branchKey: textOf(data, "branchKey"),
    outcome: enumOf(data, "outcome", OUTCOMES),
    approvalRequestId: textOrNull(data, "approvalRequestId"),
    closedAs: enumOrNull(data, "closedAs", CLOSED_AS),
    shadowDiff: flagOf(data, "shadowDiff"),
})

/** A decision record read from the engine's row. */
export const decisionRecordOf = (row: RecordRow): GraphDecisionRecord => ({
    ...headOf(row),
    ...fenceOf(row),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    ...ranOf(row.data),
    ...unjudgedOf(row.data),
    ...walkOf(row.data),
    ...answerOf(row.data),
})

/** The members of an object as plain JSON, an undefined one left out. */
const membersOf = (value: Readonly<Record<string, unknown>>): PlainJson =>
    Object.fromEntries(
        Object.entries(value)
            .filter(([, member]) => member !== undefined)
            .map(([key, member]) => [key, plainOf(member)]),
    )

/** The value as the one JSON type every branch of the conversion answers. */
const asJson = (value: JsonValue): JsonValue => value

/** A scalar JSON holds; anything else a record cannot keep is refused. */
const scalarOf = (value: unknown): JsonValue => {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        return value
    throw unreadable()
}

/** The value as plain JSON; what JSON cannot hold is refused. */
const plainOf = (value: unknown): JsonValue => {
    if (Array.isArray(value)) return asJson(value.map(plainOf))
    return asJson(isRecord(value) ? membersOf(value) : scalarOf(value))
}

/** A document or a patch as the plain JSON object a record stores; an undefined member is left out at every depth. */
export const jsonOf = (value: object): PlainJson => {
    if (Array.isArray(value) || !isRecord(value)) throw unreadable()
    return membersOf(value)
}

/** The list cut into runs of at most `size`, in order. */
export const chunksOf = <T>(list: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> =>
    Array.from({ length: Math.ceil(list.length / size) }, (_unused, index) =>
        list.slice(index * size, (index + 1) * size),
    )
