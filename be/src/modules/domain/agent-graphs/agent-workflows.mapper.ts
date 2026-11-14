import { fieldTextOf, fieldTextOrNullOf, isRecord } from "@modules/platform/primitives"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type {
    TemplateLink,
    WorkflowAuthorKind,
    WorkflowChangeKind,
    WorkflowRecord,
    WorkflowStatus,
    WorkflowVersionRecord,
} from "./agent-workflows.contracts"

/** A stored row of the workflow tables by its entity members (a TypeORM entity, or a store double's row); times are instants or ISO text. */
export type StoredWorkflowRow = object

type Data = Readonly<Record<string, unknown>>

/** The members of a stored row, by name. */
const membersOfRow = (row: StoredWorkflowRow): Data => Object.fromEntries(Object.entries(row))

const dateOf = (data: Data, key: string): Date => {
    const value = data[key]
    return value instanceof Date ? value : new Date(textOf(data, key))
}

const STATUSES: ReadonlyArray<WorkflowStatus> = ["active", "draft", "paused"]
const CHANGE_KINDS: ReadonlyArray<WorkflowChangeKind> = [
    "template",
    "blank",
    "adopt",
    "copy",
    "edit",
    "proposal",
    "accept_template",
    "rollback",
]
const AUTHOR_KINDS: ReadonlyArray<WorkflowAuthorKind> = ["owner", "nivo", "system"]

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

const intOrNull = (data: Data, key: string): number | null =>
    data[key] === null || data[key] === undefined ? null : intOf(data, key)

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

/** Whether a stored value is a JSON object; the engine checked its shape on write, so its members are JSON. */
const isJsonObject = (value: unknown): value is Readonly<Record<string, JsonValue>> => isRecord(value)

const documentOf = (data: Data): Readonly<Record<string, JsonValue>> => {
    const value = data["document"]
    if (!isJsonObject(value)) throw unreadable()
    return value
}

/** The template link a record keeps, or null when it names none (or only half of one). */
const linkOf = (data: Data): TemplateLink | null => {
    const templateId = textOrNull(data, "templateId")
    const templateVersion = intOrNull(data, "templateVersion")
    return templateId === null || templateVersion === null ? null : { templateId, templateVersion }
}

/** A workflow record read from its stored row. */
export const workflowRecordOf = (stored: StoredWorkflowRow): WorkflowRecord => {
    const row = membersOfRow(stored)
    return {
        id: textOf(row, "id"),
        workspaceId: textOf(row, "workspaceId"),
        fence: String(intOf(row, "version")),
        agentId: textOf(row, "agentId"),
        key: textOf(row, "key"),
        name: textOf(row, "name"),
        status: enumOf(row, "status", STATUSES),
        primary: flagOf(row, "primary"),
        position: intOf(row, "position"),
        activeVersionId: textOrNull(row, "activeVersionId"),
        latestNumber: intOf(row, "latestNumber"),
        template: linkOf(row),
        createdBy: textOrNull(row, "createdBy"),
        createdAt: dateOf(row, "createdAt"),
        updatedAt: dateOf(row, "updatedAt"),
    }
}

/** A workflow version record read from its stored row. */
export const workflowVersionRecordOf = (stored: StoredWorkflowRow): WorkflowVersionRecord => {
    const row = membersOfRow(stored)
    return {
        id: textOf(row, "id"),
        workspaceId: textOf(row, "workspaceId"),
        workflowId: textOf(row, "workflowId"),
        agentId: textOf(row, "agentId"),
        number: intOf(row, "number"),
        document: documentOf(row),
        documentHash: textOf(row, "documentHash"),
        changeKind: enumOf(row, "changeKind", CHANGE_KINDS),
        authorKind: enumOf(row, "authorKind", AUTHOR_KINDS),
        authorId: textOrNull(row, "authorId"),
        note: textOf(row, "note"),
        template: linkOf(row),
        fromNumber: intOrNull(row, "fromNumber"),
        graphVersionId: textOrNull(row, "graphVersionId"),
        publishedAt: dateOf(row, "publishedAt"),
    }
}
