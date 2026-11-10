import type { RecordRow, WriteLinks } from "@nivo-lite/agent-sdk/entity/port"
import type { DoorCallResult, WorkflowStart } from "@nivo-lite/agent-sdk/mutation"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import type { EntityCatalog } from "@nivo-lite/agent-sdk/query"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { FLOW_F_ENTITIES } from "../../../entities/flow-f.entities"
import type { MemberFacts } from "../../platform/platform.types"

/** The member of the fake workspace who is an accountant. */
export const ACCOUNTANT_ID = "00000000-0000-4000-8000-0000000000aa"

/** A request scope of the accountant at a fixed instant. */
export const ACCOUNTANT_CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: ACCOUNTANT_ID,
    now: new Date("2026-11-04T12:00:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

/** A request scope no seat of the workspace acts in (the graph, a job). */
export const SYSTEM_CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: null,
    now: ACCOUNTANT_CONTEXT.now,
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

/** The instant every fake record that no spec dated was created and last written at. */
const CREATED = "2026-11-03T09:00:00.000Z"

/** The entities the fake engine knows, the way the planner checks a query against them. */
export const CATALOG: EntityCatalog = new Map(FLOW_F_ENTITIES.map((entity) => [entity.name, entity]))

/** One link the fake engine holds: a record of an entity linked to another over a relation. */
export interface MemoryLink {
    /** The entity of the record that is linked. */
    readonly entity: string
    /** The id of the record that is linked. */
    readonly id: string
    /** The relation. */
    readonly relation: string
    /** The id of the target record. */
    readonly to: string
}

/** One job the fake outbox was asked to enqueue. */
export interface MemoryJob {
    /** The job name. */
    readonly job: string
    /** Its input. */
    readonly input: unknown
    /** The key that makes a repeat the same job, when the caller gave one. */
    readonly dedupeKey: string | undefined
}

/** One call the fake door was given. */
export interface MemoryCall {
    /** The door tool. */
    readonly tool: string
    /** The input of the call. */
    readonly input: Readonly<Record<string, JsonValue>>
}

/** Everything the fake ports read and record, so a spec can set it up and look at it. */
export interface MemoryWorld {
    /** The records of each entity, by entity name. */
    readonly tables: Map<string, Array<RecordRow>>
    /** The links between records. */
    readonly links: Array<MemoryLink>
    /** The members by id. */
    readonly members: Map<string, MemberFacts>
    /** The jobs the outbox was asked for. */
    readonly jobs: Array<MemoryJob>
    /** What the door was asked for. */
    readonly calls: Array<MemoryCall>
    /** The workflows the workflow port was asked to start (a repeated dedupe key is kept once, as the engine wakes once). */
    readonly starts: Array<WorkflowStart>
    /** What the door answers for a tool; a tool it does not name is unknown. */
    readonly answers: Map<string, DoorCallResult>
}

/** An empty world holding the accountant. */
export const memoryWorld = (): MemoryWorld => ({
    tables: new Map(),
    links: [],
    members: new Map([[ACCOUNTANT_ID, { displayName: "Lan", isManager: false }]]),
    jobs: [],
    calls: [],
    starts: [],
    answers: new Map(),
})

/** The records of an entity of a world. */
export const rowsOf = (world: MemoryWorld, entity: string): Array<RecordRow> => {
    const found = world.tables.get(entity)
    if (found !== undefined) return found
    const created: Array<RecordRow> = []
    world.tables.set(entity, created)
    return created
}

/** Stores a record of an entity, with the links it carries, and answers it. */
export const putRecord = (
    world: MemoryWorld,
    entity: string,
    id: string,
    data: Readonly<Record<string, unknown>>,
    options: { readonly version?: string; readonly createdAt?: string; readonly links?: WriteLinks } = {},
): RecordRow => {
    const row: RecordRow = {
        id,
        workspaceId: "w1",
        version: options.version ?? "1",
        createdAt: options.createdAt ?? CREATED,
        updatedAt: options.createdAt ?? CREATED,
        data,
    }
    rowsOf(world, entity).push(row)
    for (const [relation, to] of Object.entries(options.links ?? {})) world.links.push({ entity, id, relation, to })
    return row
}
