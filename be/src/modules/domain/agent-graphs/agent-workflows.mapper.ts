import { fieldTextOf, fieldTextOrNullOf, isRecord } from "@modules/platform/primitives"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type {
    RunWorkflowPin,
    TemplateLink,
    WorkflowAuthorKind,
    WorkflowChangeKind,
    WorkflowRecord,
    WorkflowStatus,
    WorkflowVersionRecord,
} from "./agent-workflows.contracts"

type Data = RecordRow["data"]

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

/** A workflow record read from the engine's row. */
export const workflowRecordOf = (row: RecordRow): WorkflowRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    fence: row.version,
    agentId: textOf(row.data, "agentId"),
    key: textOf(row.data, "key"),
    name: textOf(row.data, "name"),
    status: enumOf(row.data, "status", STATUSES),
    primary: flagOf(row.data, "primary"),
    position: intOf(row.data, "position"),
    activeVersionId: textOrNull(row.data, "activeVersionId"),
    latestNumber: intOf(row.data, "latestNumber"),
    template: linkOf(row.data),
    createdBy: textOrNull(row.data, "createdBy"),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
})

/** A workflow version record read from the engine's row. */
export const workflowVersionRecordOf = (row: RecordRow): WorkflowVersionRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    workflowId: textOf(row.data, "workflowId"),
    agentId: textOf(row.data, "agentId"),
    number: intOf(row.data, "number"),
    document: documentOf(row.data),
    documentHash: textOf(row.data, "documentHash"),
    changeKind: enumOf(row.data, "changeKind", CHANGE_KINDS),
    authorKind: enumOf(row.data, "authorKind", AUTHOR_KINDS),
    authorId: textOrNull(row.data, "authorId"),
    note: textOf(row.data, "note"),
    template: linkOf(row.data),
    fromNumber: intOrNull(row.data, "fromNumber"),
    graphVersionId: textOrNull(row.data, "graphVersionId"),
    publishedAt: new Date(textOf(row.data, "publishedAt")),
})

/** A run pin read from the engine's row. */
export const runWorkflowPinOf = (row: RecordRow): RunWorkflowPin => ({
    runId: textOf(row.data, "runId"),
    workflowId: textOf(row.data, "workflowId"),
    workflowVersionId: textOf(row.data, "workflowVersionId"),
    workflowVersion: intOf(row.data, "workflowVersion"),
})
