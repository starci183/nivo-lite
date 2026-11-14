import { fieldTextOf, fieldTextOrNullOf, isRecord } from "@modules/platform/primitives"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type {
    GraphChangeKind,
    GraphMode,
    ProposalKind,
    ProposalStatus,
} from "./agent-graphs.contracts"
import type {
    GraphRecord,
    PlainJson,
    ProposalRecord,
    GraphSourceRecord,
    VersionRecord,
} from "./agent-graphs-records.contracts"

/**
 * A stored row of one of the graph tables by its entity members: a TypeORM entity of `persistence/entities`, or a store double's row.
 * Times are instants or ISO text; `version` is the row's fence.
 */
export type StoredRow = object

type Data = Readonly<Record<string, unknown>>

/** The members of a stored row, by name. */
const membersOfRow = (row: StoredRow): Data => Object.fromEntries(Object.entries(row))

const GRAPH_MODES: ReadonlyArray<GraphMode> = ["shadow", "enforced"]
/** The change kinds of a graph version the be writes and reads (the check of `agent_graph_versions.change_kind`). */
export const GRAPH_CHANGE_KINDS: ReadonlyArray<GraphChangeKind> = [
    "seed",
    "chat",
    "edit",
    "conflict",
    "learned",
    "template",
    "rollback",
    "spec",
    "copy",
]
const PROPOSAL_KINDS: ReadonlyArray<ProposalKind> = ["conflict", "learned", "template_update", "gap", "contract"]
const PROPOSAL_STATUSES: ReadonlyArray<ProposalStatus> = ["open", "confirmed", "declined", "superseded"]

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

const dateOf = (data: Data, key: string): Date => {
    const value = data[key]
    return value instanceof Date ? value : new Date(textOf(data, key))
}

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


/** What every row carries: its id and its workspace. */
const headOf = (row: Data): Pick<GraphRecord, "id" | "workspaceId"> => ({
    id: textOf(row, "id"),
    workspaceId: textOf(row, "workspaceId"),
})

/** What a row written under a fence carries besides its head: its version. */
const fenceOf = (row: Data): Pick<GraphRecord, "fence"> => ({ fence: String(intOf(row, "version")) })

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

/** A graph record read from its stored row. */
export const graphRecordOf = (stored: StoredRow): GraphRecord => {
    const row = membersOfRow(stored)
    return {
        ...headOf(row),
        ...fenceOf(row),
        ...wiringOf(row),
        ...modeOf(row),
    }
}

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
    changeKind: enumOf(data, "changeKind", GRAPH_CHANGE_KINDS),
    note: textOf(data, "note"),
    publishedBy: textOrNull(data, "publishedBy"),
    publishedAt: dateOf(data, "publishedAt"),
})

/** A version record read from its stored row. */
export const versionRecordOf = (stored: StoredRow): VersionRecord => {
    const row = membersOfRow(stored)
    return {
        ...headOf(row),
        ...frozenOf(row),
        ...publishedOf(row),
    }
}

const citedOf = (data: Data): Pick<GraphSourceRecord, "versionId" | "agentId" | "nodeKey" | "branchKey"> => ({
    versionId: textOf(data, "versionId"),
    agentId: textOf(data, "agentId"),
    nodeKey: textOf(data, "nodeKey"),
    branchKey: textOf(data, "branchKey"),
})

const backedByOf = (data: Data): Pick<GraphSourceRecord, "kind" | "ref" | "valueHash"> => ({
    kind: textOf(data, "kind"),
    ref: textOf(data, "ref"),
    valueHash: textOf(data, "valueHash"),
})

/** A source record read from its stored row. */
export const sourceRecordOf = (stored: StoredRow): GraphSourceRecord => {
    const row = membersOfRow(stored)
    return {
        workspaceId: textOf(row, "workspaceId"),
        ...citedOf(row),
        ...backedByOf(row),
    }
}

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

/** A proposal record read from its stored row. */
export const proposalRecordOf = (stored: StoredRow): ProposalRecord => {
    const row = membersOfRow(stored)
    return {
        ...headOf(row),
        ...fenceOf(row),
        createdAt: dateOf(row, "createdAt"),
        ...raisedOf(row),
        ...aboutOf(row),
        ...changeOf(row),
    }
}

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
    if (Array.isArray(value)) return asJson(value.map((item) => plainOf(item)))
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
