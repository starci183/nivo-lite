import { CustomerChatError } from "../service/chat-types"
import { TOOL, type ToolId } from "@nivo-lite/agent-sdk/names"
import { filterExprSchema, type OrderBy } from "@nivo-lite/agent-sdk/query"
import type { JsonObject, JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { DeclinedAnswer, NodeContext, TemplateNodeTools, ToolAnswer } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import type { RecordToolsHandle } from "../service/record-tools.entities"
import type { FakeChat } from "./chat-store.memory"

/** What a record tool answers in the memory store: a refusal or a value (a spec scripts the answers of any other tool). */
export type MemoryToolAnswer = ToolAnswer<JsonObject, string> | DeclinedAnswer

/** One call a node made to a tool: the tool and the arguments it sent. */
export interface RecordToolCall {
    /** The tool called. */
    readonly id: ToolId
    /** The arguments the node sent. */
    readonly args: JsonObject
}

/** The node's tool handle over the memory chat store, and what the node asked of it. */
export interface MemoryRecordTools extends RecordToolsHandle {
    /** Every call, in order. */
    readonly calls: Array<RecordToolCall>
    /** The answers of the tools that are no record tool (a send), by id, scripted by the spec. */
    readonly answers: Map<ToolId, MemoryToolAnswer>
}

const ORDER_MAX = 8
const LINKS_MAX = 8
const FIELDS_MAX = 64
const LIST_DEFAULT = 20

const orderSchema = z.array(z.tuple([z.string().max(MAX_ID), z.enum(["asc", "desc"])])).max(ORDER_MAX)
const linksSchema = z.record(z.string().max(MAX_ID), z.string().max(MAX_ID)).refine((links) => Object.keys(links).length <= LINKS_MAX)

/** True for a JSON object (not a list). */
const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: JsonValue | undefined): string => (typeof value === "string" ? value : "")

const refusal = (code: string): MemoryToolAnswer => ({ ok: false, refusal: code, facts: {} })
const done = (value: JsonObject): MemoryToolAnswer => ({ ok: true, value, via: { provider: null, connectionId: null } })

/** The record as the record tools answer it, from the fake store's own row. */
const viewOf = (chat: FakeChat, type: string, id: string): JsonObject | null => {
    const row = chat.rows.get(type)?.get(id)
    return row === undefined
        ? null
        : { id: row.id, version: row.version, createdAt: row.createdAt, updatedAt: row.updatedAt, values: row.data }
}

const listed = async (chat: FakeChat, type: string, args: JsonObject): Promise<MemoryToolAnswer> => {
    const where = args["where"] === undefined ? undefined : filterExprSchema.parse(args["where"])
    const order: OrderBy = orderSchema.parse(args["order"] ?? [])
    const fields = Array.isArray(args["fields"]) ? args["fields"].map((field) => textOf(field)).slice(0, FIELDS_MAX) : []
    const size = typeof args["limit"] === "number" ? args["limit"] : LIST_DEFAULT
    const page = await chat.api.list({ from: type, select: fields, ...(where === undefined ? {} : { where }), order, page: { size } })
    const records = page.rows.flatMap((one) => viewOf(chat, type, one.row.id) ?? [])
    return done({ records, next: page.next })
}

const created = async (chat: FakeChat, type: string, args: JsonObject): Promise<MemoryToolAnswer> => {
    const values = args["values"]
    const links = args["links"] === undefined ? undefined : linksSchema.parse(args["links"])
    const written = await chat.api.insert(type, isJsonObject(values) ? values : {}, links)
    if (!written.ok) return refusal(written.reason)
    const record = viewOf(chat, type, written.row.id)
    return record === null ? refusal("not_found") : done({ record })
}

const updated = async (chat: FakeChat, type: string, args: JsonObject): Promise<MemoryToolAnswer> => {
    const patch = args["patch"]
    const written = await chat.api.update(type, textOf(args["id"]), textOf(args["version"]), isJsonObject(patch) ? patch : {})
    if (!written.ok) return refusal(written.reason === "missing" ? "not_found" : written.reason)
    const record = viewOf(chat, type, written.row.id)
    return record === null ? refusal("not_found") : done({ record })
}

/** What one record tool answers over the store. */
const recordToolOf = async (chat: FakeChat, id: ToolId, args: JsonObject): Promise<MemoryToolAnswer | null> => {
    const type = textOf(args["type"])
    if (id === TOOL.recordGet) {
        const record = viewOf(chat, type, textOf(args["id"]))
        return record === null ? refusal("not_found") : done({ record })
    }
    if (id === TOOL.recordList) return listed(chat, type, args)
    if (id === TOOL.recordCreate) return created(chat, type, args)
    if (id === TOOL.recordUpdate) return updated(chat, type, args)
    return null
}

/** The way a node ends in a spec: a throw that says why. */
const ended: NodeContext["fail"] = (reason) => {
    throw new CustomerChatError("CUSTOMER_CHAT_NOT_STORED", `the node ended: ${JSON.stringify(reason)}`)
}

/**
 * The record tools of ONE agent over the in-memory chat store: the same four calls the engine's tool serves (`get`, `list`, `create`,
 * `update`), answering the same shapes and the refusals `not_found`, `taken` and `stale`. `create` takes the `links` the real tool is
 * to take for a record with a required relation (the chat of a message). A call to any other tool answers what the spec scripted.
 */
export const memoryRecordTools = (chat: FakeChat): MemoryRecordTools => {
    const calls: Array<RecordToolCall> = []
    const answers = new Map<ToolId, MemoryToolAnswer>()
    const call = async (id: ToolId, args: JsonObject): Promise<MemoryToolAnswer> => {
        calls.push({ id, args })
        return (await recordToolOf(chat, id, args)) ?? answers.get(id) ?? refusal("not_scripted")
    }
    // The one assertion of the double: the engine's door answers the shape the call's tool declares; this memory door answers by id.
    const tools = { call } as TemplateNodeTools
    return { calls, answers, tools, fail: ended }
}

/** A node context over those tools, for a spec that runs a node's `run` itself. */
export const memoryNodeContext = (tools: MemoryRecordTools, at = "2026-11-13T03:00:00.000Z"): NodeContext => ({
    params: {},
    run: { id: "run-1", at, day: at.slice(0, 10), item: null, queue: [], waiting: 0 },
    subject: null,
    workspace: { timeZone: "Asia/Ho_Chi_Minh", name: "Shop" },
    tools: tools.tools,
    agent: {
        run: () => {
            throw new CustomerChatError("CUSTOMER_CHAT_NOT_STORED", "a code node never asks the model")
        },
    },
    policy: {},
    fail: tools.fail,
})
