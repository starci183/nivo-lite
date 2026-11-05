import type { z } from "../schema/zod-entry"
import { rightsGaps } from "../rights/rights"
import type { DataAccess, DataRight, RightScope, RightsGrant } from "../rights/rights.types"
import { isRecord } from "../schema/is-record"
import type { Namespaced } from "../schema/schema.types"
import type { NodeHostPorts, NodeRun, NodeRunEffect, NodeRunRequest } from "./host.types"
import { NodeRunError } from "./node-run-error"
import type {
    EffectOptions,
    EffectPayload,
    NodeContext,
    NodeTools,
    NodeQuery,
    NodeModelRequest,
    SubjectRef,
} from "./node.types"
import { RightsDeniedError } from "./rights-denied-error"
import { ToolUndeclaredError } from "./tool-undeclared-error"
import { trusted } from "../schema/trusted"

/** Whether a grant covers one right. */
const covers = (grant: RightsGrant, right: DataRight): boolean => rightsGaps(grant, [right]).length === 0

/** The right a call needs, or a refusal when it names no field. */
const rightOf = (kind: string, access: DataAccess, scope: RightScope, fields: ReadonlyArray<string>): DataRight => {
    const [first, ...rest] = fields
    if (first === undefined) throw new RightsDeniedError(kind)
    return { kind, access, scope, fields: [first, ...rest] }
}

/**
 * The scope a call runs in: the widest the node declared for these fields, and only when the agent's grant covers it too. A call
 * outside either is refused: default deny.
 */
const scopeOf = (
    request: NodeRunRequest,
    kind: string,
    access: DataAccess,
    fields: ReadonlyArray<string>,
): RightScope => {
    const declared = { rights: request.node.rights }
    const scope = (["workspace", "turn"] as const).find((candidate) =>
        covers(declared, rightOf(kind, access, candidate, fields)),
    )
    if (scope === undefined || !covers(request.grant, rightOf(kind, access, scope, fields))) {
        throw new RightsDeniedError(kind)
    }
    return scope
}

/** Parses a value with a node schema, or refuses with the code. */
const parsed = <S extends z.ZodType>(
    schema: S,
    value: unknown,
    code: NodeRunError["code"],
    at: string,
): z.output<S> => {
    const result = schema.safeParse(value)
    if (!result.success) throw new NodeRunError(code, at)
    return result.data
}

/** Parses a payload or an argument list with a node schema, or refuses with the code when the schema yields anything but a record. */
const parsedRecord = (
    schema: z.ZodType,
    value: unknown,
    code: NodeRunError["code"],
    at: string,
): Readonly<Record<string, unknown>> => {
    const result = parsed(schema, value, code, at)
    if (!isRecord(result)) throw new NodeRunError(code, at)
    return result
}

/**
 * The tools a node reaches: declared, installed, granted by name and by right, never mutating from a condition, args and answer
 * parsed. Each call is keyed by the run step and its order, so the door can replay instead of calling again.
 */
const toolsOf = (request: NodeRunRequest, ports: NodeHostPorts): NodeTools => {
    const { node } = request
    let calls = 0
    return {
        call: async <R>(name: Namespaced, args: Readonly<Record<string, unknown>>): Promise<R> => {
            if (!(node.tools ?? []).includes(name)) throw new ToolUndeclaredError(name)
            const tool = request.tools.get(name)
            if (tool === undefined) throw new NodeRunError("TOOL_UNKNOWN", name)
            if (tool.mutates && node.role === "condition") throw new NodeRunError("TOOL_MUTATES", name)
            const named = (request.grant.tools ?? []).includes(name)
            if (!named || rightsGaps(request.grant, tool.rights).length > 0) throw new RightsDeniedError(name)
            const checked = parsedRecord(tool.args, args, "TOOL_ARGS_INVALID", name)
            const key = `${request.key}:tool:${calls}`
            calls += 1
            return trusted<R>(
                parsed(tool.result, await ports.callTool(tool, checked, key), "TOOL_RESULT_INVALID", name),
            )
        },
    }
}

/** The context a node runs with: every call checked, every effect counted. */
const contextOf = (
    request: NodeRunRequest,
    ports: NodeHostPorts,
    params: unknown,
    done: Array<NodeRunEffect>,
): NodeContext => {
    const { node } = request
    const purpose = (model: NodeModelRequest): NodeModelRequest => ({
        ...model,
        purpose: `${node.id}:${model.purpose}`,
    })
    return {
        turn: request.turn,
        params,
        data: {
            read: async <T>(kind: string, query: NodeQuery): Promise<ReadonlyArray<T>> => {
                const scope = scopeOf(request, kind, "read", query.fields)
                return trusted<ReadonlyArray<T>>(await ports.read(kind, query, scope))
            },
            write: (kind, record) => {
                scopeOf(request, kind, "write", Object.keys(record))
                return ports.write(kind, record)
            },
        },
        effect: async (kind: Namespaced, payload: EffectPayload, options: EffectOptions = {}): Promise<SubjectRef> => {
            if (!node.effects.includes(kind)) throw new NodeRunError("EFFECT_UNDECLARED", kind)
            const effect = request.effects.get(kind)
            if (effect === undefined) throw new NodeRunError("EFFECT_UNKNOWN", kind)
            const checked = parsedRecord(effect.payload, payload, "EFFECT_PAYLOAD_INVALID", kind)
            if (rightsGaps(request.grant, effect.rights).length > 0) throw new RightsDeniedError(kind)
            const call = { key: `${request.key}:${done.length}`, dedupeKey: options.dedupeKey ?? null }
            const subject = await ports.execute(effect, checked, call)
            done.push({ id: kind, subject })
            return subject
        },
        model: {
            text: (model) => ports.model.text(purpose(model)),
            json: (schema, model) => ports.model.json(schema, purpose(model)),
        },
        tools: toolsOf(request, ports),
        now: ports.now,
    }
}

/**
 * Runs one node the way every host must: params and input parsed by the node's schemas, the agent's grant covering every right the
 * node requires, each read and write checked against both the node's declared rights and the grant, each effect declared, installed,
 * its payload parsed and its rights granted before the port acts, each tool the same through the NIVO MCP door, and the output parsed. Default deny throughout.
 */
export const runNode = async (request: NodeRunRequest, ports: NodeHostPorts): Promise<NodeRun> => {
    const { node } = request
    const params = parsed(node.params, request.params, "PARAMS_INVALID", node.id)
    const input = parsed(node.input, request.input, "INPUT_INVALID", node.id)
    const [gap] = rightsGaps(request.grant, node.rights)
    if (gap !== undefined) throw new RightsDeniedError(gap.right.kind)
    const effects: Array<NodeRunEffect> = []
    const raw = await node.run(input, contextOf(request, ports, params, effects))
    return { output: parsed(node.output, raw, "OUTPUT_INVALID", node.id), effects }
}
