import type { EngineResult, EntitiesApi, ListPage, RecordRow, WriteLinks, WriteValues } from "@nivo-lite/agent-sdk/entity/port"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { CustomerChatError } from "../service/chat-types"
import type { Query } from "@nivo-lite/agent-sdk/query"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { asJson, type NodeContext } from "@nivo-lite/agent-sdk/template"

/**
 * What a node holds of the engine's data: its tool handle and its way to end. A node never receives the entities port (that is the
 * business of reads, actions and services); its own records are reached through the default record tools of its own agent
 * (`nivo.tool.record.*`, nivo-toolset "records"). This adapter lets the chatbot's own service functions (`hearOver`, the say step's
 * marks) run over those tools.
 */
export type RecordToolsHandle = Pick<NodeContext, "tools" | "fail">

/** True for a JSON object (not a list). */
const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The record a record tool's answer member holds, or null when it is no record. */
const rowOf = (value: unknown): RecordRow | null => {
    if (!isObject(value)) return null
    const { id, version, createdAt, updatedAt, values } = value
    if (typeof id !== "string" || typeof version !== "string" || typeof createdAt !== "string" || typeof updatedAt !== "string") return null
    return isObject(values) ? { id, workspaceId: "", version, createdAt, updatedAt, data: values } : null
}

/** The refusal code of a record tool a write turns into the engine's result. */
const writeRefusalOf = (refusal: string): EngineResult => {
    if (refusal === "taken") return { ok: false, reason: "taken", constraint: "", refusal: "taken" }
    if (refusal === "stale") return { ok: false, reason: "stale" }
    if (refusal === "not_found") return { ok: false, reason: "missing" }
    return { ok: false, reason: "invalid" }
}

const unsupported = (call: string): Promise<never> => {
    throw new CustomerChatError("CUSTOMER_CHAT_NOT_STORED", `The record tools do not serve ${call} to a node.`)
}

/**
 * The entity port of a node's own agent over the record tools. It serves what the chatbot's node services call: `get`, `list`,
 * `insert` and `update`. A read that the tool refuses ends the node as `cannot`;
 * a write the tool refuses answers the engine's result (`taken`, `stale`, `missing`, `invalid`) so the service's own retry and
 * idempotence run unchanged. `insert` passes `links` (the toOne relations of the record) beside `type` and `values`: the record
 * create tool must take them for a record with a required relation.
 */
export const entitiesOverRecordTools = (handle: RecordToolsHandle): EntitiesApi => {
    const stop = (why: string): never => handle.fail({ kind: "cannot", why })
    /** The record a tool answered, or the node stops. */
    const recordOf = (value: unknown): RecordRow => rowOf(value) ?? stop("a record tool answered a record of an unknown shape")

    const get: EntitiesApi["get"] = async (entity, id) => {
        const answer = await handle.tools.call(TOOL.recordGet, { type: entity, id })
        if (!answer.ok) {
            if (answer.refusal === "not_found") return null
            return stop(`${TOOL.recordGet} refused: ${answer.refusal}`)
        }
        return recordOf(answer.value["record"])
    }

    const list = async (query: Query): Promise<ListPage> => {
        const args: JsonObject = {
            type: query.from,
            fields: [...query.select],
            order: query.order.map(([field, direction]) => [field, direction]),
            limit: query.page.size,
            ...(query.where === undefined ? {} : { where: asJson(query.where) }),
            ...(query.page.after === undefined ? {} : { cursor: query.page.after }),
        }
        const answer = await handle.tools.call(TOOL.recordList, args)
        if (!answer.ok) return stop(`${TOOL.recordList} refused: ${answer.refusal}`)
        const records: unknown = answer.value["records"]
        const next: unknown = answer.value["next"]
        if (!Array.isArray(records)) return stop(`${TOOL.recordList} answered an unknown shape`)
        return {
            rows: records.map((record: unknown) => {
                const row = rowOf(record)
                return row === null ? stop(`${TOOL.recordList} answered a record of an unknown shape`) : { row, joined: {}, position: [row.id], included: {} }
            }),
            next: typeof next === "string" ? next : null,
        }
    }

    const insert = async (entity: string, values: WriteValues, links?: WriteLinks): Promise<EngineResult> => {
        const args: JsonObject = {
            type: entity,
            values,
            ...(links === undefined ? {} : { links: { ...links } }),
        }
        const answer = await handle.tools.call(TOOL.recordCreate, args)
        if (!answer.ok) {
            if (answer.declined === true) return stop(`${TOOL.recordCreate} declined`)
            return writeRefusalOf(answer.refusal)
        }
        const row = recordOf(answer.value["record"])
        return { ok: true, row, version: row.version, created: true }
    }

    const update: EntitiesApi["update"] = async (entity, key, expected, values) => {
        const answer = await handle.tools.call(TOOL.recordUpdate, {
            type: entity,
            id: key,
            patch: values,
            version: expected,
        })
        if (!answer.ok) {
            if (answer.declined === true) return stop(`${TOOL.recordUpdate} declined`)
            return writeRefusalOf(answer.refusal)
        }
        const row = recordOf(answer.value["record"])
        return { ok: true, row, version: row.version }
    }

    return {
        get,
        list,
        insert,
        update,
        ensure: () => unsupported("ensure"),
        aggregate: () => unsupported("aggregate"),
        upsert: () => unsupported("upsert"),
        delete: () => unsupported("delete"),
        link: () => unsupported("link"),
        unlink: () => unsupported("unlink"),
    }
}
