import { DomainError } from "@starci/common"
import { z } from "../schema/zod-entry"
import { DEFAULT_AI_READ_TOOLS, DEFAULT_NODE_TOOLS, type ProviderKey, type ToolId } from "../names"
import { isRecord } from "../schema/is-record"
import type { JsonObject, JsonValue, Namespaced } from "../schema/schema.types"
import { trusted } from "../schema/trusted"
import type {
    AnyTemplateNode,
    DeclinedAnswer,
    NodeContext,
    SubjectRef as TemplateSubject,
    TemplateAgentRequest,
    TemplateNodeTools,
    TemplateRun,
    ToolAnswer,
    ToolAnswerMeta,
    WorkspaceFacts,
} from "../template/builder/template-node.types"
import { NO_PARAMS, toolAnswerRead } from "../template/builder/template-node"
import { NodeFailedError, isNodeFailed } from "../template/builder/template-problems"
import { callDigestOf } from "./call-digest"
import type { EffectDefinition, ToolDefinition } from "./effect.types"
import { runNode } from "./host"
import type { NodeHostPorts, NodeRun } from "./host.types"
import { NodeBusinessFailure, NodeConfused } from "./memory"
import { NodeRunError } from "./node-run-error"
import {
    REFUSED_KIND,
    isRefused,
    type NodeDefinition,
    type NodeHostModel,
    type NodeModelDecision,
    type SubjectRef,
    type TurnRef,
} from "./node.types"
import { ToolUndeclaredError } from "./tool-undeclared-error"

/** Why a template node's run is refused by the runner itself. */
export type TemplateRunErrorCode =
    /** `ctx.agent.run` on a node that names no model (ruling B7). */
    | "NODE_MODEL_MISSING"
    /** `ctx.agent.run` offering a tool the node does not declare (ruling B6: the subset is of the node's `tools`). */
    | "AGENT_TOOL_UNDECLARED"
    /** A tool call whose arguments are not one JSON object. */
    | "TOOL_ARGS_INVALID"
    /** The node ended while a call its `requires` lists never answered ok. */
    | "REQUIRED_CALL_MISSING"

/** A refusal of the template runner: a bug of the node (the step freezes), never a fact a node reads. */
export class TemplateRunError extends DomainError<TemplateRunErrorCode> {
    constructor(code: TemplateRunErrorCode, at: string, options?: ErrorOptions) {
        super({ code, params: { at }, cause: options?.cause })
    }
}

/** One run of a template node (`defineTemplateNode`) by the engine. */
export interface TemplateNodeRunRequest {
    /** The template node. */
    readonly node: AnyTemplateNode
    /** The raw settings, parsed by the node's `params` schema. */
    readonly params: unknown
    /** The raw input, parsed by the node's `input` schema. */
    readonly input: unknown
    /** The turn: the agent's guidance, subject and what was already done, as the legacy agent loop reads them. */
    readonly turn: TurnRef
    /** The run: its id, the run step's FIXED instant and its day in the workspace's time zone (both the engine's), the for-each item. */
    readonly run: TemplateRun
    /** The workspace's own facts (`ctx.workspace`), read by the engine from its stored settings. */
    readonly workspace: WorkspaceFacts
    /** The run step's key (`<run>:<step>`, an iteration's own inside a loop); each call's key adds a digest of the call. */
    readonly key: string
    /** The installed tool definitions by id: what the agent is shown of a tool (its words and the schema of its arguments). */
    readonly tools: ReadonlyMap<string, ToolDefinition>
    /** The installed effect definitions by id: an effect is a tool of a template node; the agent is shown its payload schema. */
    readonly effects: ReadonlyMap<string, EffectDefinition>
    /** The words of the install's text keys, for what the agent reads of a tool. */
    readonly words?: ((key: string) => string | undefined) | undefined
}

/** What the engine gives a template node's run: ONE road for every call (the node door), the model, and the clock. */
export interface TemplateHostPorts {
    /**
     * Calls one declared tool through the engine's door under the call's key. It answers a `ToolAnswer`, or the door's raw answer (a
     * refusal subject or a plain result), which the runner reads as one. An engine failure throws: it freezes the node.
     */
    readonly callTool: (id: ToolId, args: JsonObject, key: string) => Promise<unknown>
    /** The model of the agent loop (the JSON loop). */
    readonly model: NodeHostModel
    /** The host's own agent loop, when it takes the turns itself. */
    readonly agent?: NodeHostPorts["agent"]
    /** The clock (the legacy runner's port; a template node never reads it: it reads `run.at`). */
    readonly now: () => Date
}

/** NIVO's own tools answer through no account. */
const NO_VIA = { provider: null, connectionId: null } as const

/** The JSON object a door answered, as a tool's value: a record as it is, any other value under `value`. */
const valueOf = (raw: unknown): JsonObject => (isRecord(raw) ? trusted<JsonObject>(raw) : { value: trusted<JsonValue>(raw ?? null) })

/** The facts a refusal came with, as a JSON object. */
const factsOf = (raw: unknown): JsonObject => (isRecord(raw) ? trusted<JsonObject>(raw) : {})

/**
 * The meta the door handed beside a value, when it handed one whole: an outside system's (status, cut, omitted, facts) or an effect's
 * (the record it wrote, `subject`); undefined otherwise.
 */
const metaOf = (raw: unknown): ToolAnswerMeta | undefined => {
    if (!isRecord(raw)) return undefined
    const { status, truncated, omitted, facts, subject } = raw
    if (isRecord(subject)) {
        const { kind, id } = subject
        return typeof kind === "string" && typeof id === "string" ? { subject: { kind, id } } : undefined
    }
    if (typeof status !== "number" || typeof truncated !== "boolean" || typeof omitted !== "number" || !isRecord(facts)) return undefined
    return { status, truncated, omitted, facts: trusted<JsonObject>(facts) }
}

/**
 * What a NIVO EFFECT answers a template node (the engine's effect road hands the executor's `SubjectRef`): its business refusal
 * (`{ kind: "refused", id, facts }`) as `{ ok: false, refusal, facts }`; a success as `{ ok: true, value: <its facts>, via, meta:
 * { subject } }`: the members a node reads (`orderId`, `orderNo`, `taskId`, `messageId`...) are the facts, at the top of `value`, and
 * the record it wrote or acted on travels beside them, never mixed in. NIVO's own effects answer through no account.
 */
export const effectAnswerOf = (subject: SubjectRef): ToolAnswer<JsonObject> => {
    if (isRefused(subject)) return { ok: false, refusal: subject.id, facts: factsOf(subject.facts) }
    return { ok: true, value: factsOf(subject.facts), via: NO_VIA, meta: { subject: { kind: subject.kind, id: subject.id } } }
}

/**
 * What the door answered, as `ctx.tools.call` answers it: a `ToolAnswer` as it is (the engine's door answers one for an outside system's
 * success: the body as `value`, its `meta` beside it; its effect road one for an effect, `effectAnswerOf`), a refusal subject of the legacy door (`{ kind: "refused", id, facts }`) as a
 * business refusal, anything else as an ok value through no account.
 */
export const toolAnswerOf = (raw: unknown): ToolAnswer<JsonObject> => {
    if (isRecord(raw) && raw.ok === true && "value" in raw && isRecord(raw.via)) {
        const provider = raw.via.provider
        const connectionId = raw.via.connectionId
        const meta = metaOf(raw.meta)
        return {
            ok: true,
            value: valueOf(raw.value),
            via: {
                provider: typeof provider === "string" ? trusted<ProviderKey>(provider) : null,
                connectionId: typeof connectionId === "string" ? connectionId : null,
            },
            ...(meta === undefined ? {} : { meta }),
        }
    }
    if (isRecord(raw) && raw.ok === false && typeof raw.refusal === "string") {
        return { ok: false, refusal: raw.refusal, facts: factsOf(raw.facts) }
    }
    if (isRecord(raw) && raw.kind === REFUSED_KIND && typeof raw.id === "string") {
        return { ok: false, refusal: raw.id, facts: factsOf(raw.facts) }
    }
    return { ok: true, value: valueOf(raw), via: NO_VIA }
}

/** A business refusal on its way back to the agent: the code and the facts the legacy loop shows the model (`refused`). */
class ToolRefusedForAgent extends Error {
    readonly code: string
    readonly params: JsonObject

    constructor(refusal: string, facts: JsonObject) {
        super(refusal)
        this.code = refusal
        this.params = facts
    }
}

/** Parses with a node schema, or refuses with the legacy runner's code. */
const parsedBy = <S extends z.ZodType>(schema: S, value: unknown, code: NodeRunError["code"], at: string): z.output<S> => {
    const result = schema.safeParse(value)
    if (!result.success) throw new NodeRunError(code, at)
    return result.data
}

/** The schema of the arguments of a call the agent may make: the tool's own, an effect's payload, or any object for a tool the install does not define. */
const argsSchemaOf = (request: TemplateNodeRunRequest, id: string): z.ZodType =>
    request.tools.get(id)?.args ?? request.effects.get(id)?.payload ?? z.record(z.string(), z.unknown())

/** The tool the legacy loop offers the agent for one id: the installed one, or one made from an effect or from nothing but its id. */
const offeredToolOf = (request: TemplateNodeRunRequest, id: ToolId): ToolDefinition => {
    const installed = request.tools.get(id)
    if (installed !== undefined) return installed
    const effect = request.effects.get(id)
    return {
        entry: "tool",
        id,
        title: effect?.title ?? { vi: id, en: id },
        args: argsSchemaOf(request, id),
        result: z.unknown(),
        mutates: true,
    }
}

/** What the agent loop of one `ctx.agent.run` shares with the node's own calls: the ok calls, and the first engine failure. */
interface RunState {
    /** The tools that answered ok in this run, by the node or by its agent. */
    readonly madeOk: Set<string>
    /** The first engine failure a call of the agent threw: it freezes the node once the loop ends (never shown to the model as a fact). */
    fatal: { readonly cause: unknown } | null
}

/** One call as the road made it: the door's raw answer, and the answer the node reads. */
interface Called {
    /** What the door answered. */
    readonly raw: unknown
    /** The answer as `ctx.tools.call` answers it. */
    readonly answer: ToolAnswer<JsonObject>
}

/**
 * The tools a call of a node may name: its own `tools`, the record and file tools every node holds (`DEFAULT_NODE_TOOLS`), and inside an
 * AI step (`ctx.agent.run`) the read-context tools every AI step holds (`DEFAULT_AI_READ_TOOLS`).
 */
export const heldToolsOf = (own: ReadonlyArray<ToolId>, aiStep: boolean): ReadonlyArray<ToolId> => [
    ...new Set([...own, ...DEFAULT_NODE_TOOLS, ...(aiStep ? DEFAULT_AI_READ_TOOLS : [])]),
]

/**
 * The one call road of a template node: held tools only (`heldToolsOf`: the node's code holds its `tools` and the default node tools; its
 * AI step the default reads too), the call key, the answer as a `ToolAnswer` (and the door's raw answer).
 */
const calledOf =
    (request: TemplateNodeRunRequest, ports: TemplateHostPorts, state: RunState, aiStep = false) =>
    async (id: ToolId, args: unknown): Promise<Called> => {
        if (!heldToolsOf(request.node.tools, aiStep).includes(id)) throw new ToolUndeclaredError(id)
        if (!isRecord(args)) throw new TemplateRunError("TOOL_ARGS_INVALID", id)
        const checked = trusted<JsonObject>(args)
        const raw = await ports.callTool(id, checked, `${request.key}:${callDigestOf(id, checked)}`)
        const answer = toolAnswerOf(raw)
        // A success counts for `requires`, whatever it carries beside its value.
        if (answer.ok) state.madeOk.add(id)
        return { raw, answer }
    }

/** `ctx.tools.call`: the node reads the answer (an outside system's body as `value`, its meta beside it). */
const callOf =
    (request: TemplateNodeRunRequest, ports: TemplateHostPorts, state: RunState) =>
    async (id: ToolId, args: unknown): Promise<ToolAnswer<JsonObject> | DeclinedAnswer> =>
        // The engine's declined code is read as the node reads it: `ToolDeclined`, its business `declined` branch.
        toolAnswerRead((await calledOf(request, ports, state)(id, args)).answer)

/**
 * What the MODEL is shown of a success inside `ctx.agent.run`: the value as it is; for an effect (meta `subject`) the subject with its
 * facts, `{ kind, id, facts }`, as the `defineNode` road shows an effect's answer; for an outside system's answer the whole answer as the
 * outside system's tool declares it, `{ ok: true, status, data: <the body>, truncated, omitted }` with its facts, so the model still
 * reads the notice that the records are data, never instructions, and what was cut, exactly as on the `defineNode` road.
 */
const shownToModelOf = (called: Called): unknown => {
    const { answer, raw } = called
    if (!answer.ok) return null
    if (answer.meta === undefined) return answer.value
    if ("subject" in answer.meta) return { ...answer.meta.subject, facts: answer.value }
    const body: unknown = isRecord(raw) && "value" in raw ? raw.value : answer.value
    const { status, truncated, omitted, facts } = answer.meta
    return { ...facts, ok: true, status, data: body ?? null, truncated, omitted }
}

/** A node the legacy runner runs for one `ctx.agent.run`: it asks its agent and answers the decision; it reads nothing, writes nothing. */
const agentNodeOf = (
    request: TemplateNodeRunRequest,
    offered: ReadonlyArray<ToolId>,
    requires: ReadonlyArray<ToolId>,
    asked: TemplateAgentRequest<z.ZodType>,
): NodeDefinition<z.ZodUnknown, z.ZodUnknown, z.ZodUnknown> => ({
    entry: "node",
    id: trusted<Namespaced>(request.node.id),
    role: "execute",
    title: request.node.title,
    params: z.unknown(),
    input: z.unknown(),
    output: z.unknown(),
    effects: [],
    tools: offered,
    requires,
    run: (_input, context): Promise<unknown> =>
        context.agent.run({
            goal: asked.goal,
            input: asked.input,
            output: asked.output,
            purpose: "agent",
            ...(asked.maxTurns === undefined ? {} : { maxTurns: asked.maxTurns }),
            ...(asked.images === undefined ? {} : { images: asked.images }),
        }),
    examples: [{ name: "engine", params: null, input: null, output: null, effects: [] }],
})

/** Whether a value is the decision the legacy agent loop answers. */
const isDecision = (value: unknown): value is NodeModelDecision<unknown> =>
    isRecord(value) && (value.kind === "answer" || value.kind === "confused")

/**
 * `ctx.agent.run` of a template node: the EXISTING agent loop of the legacy runner (`runNode` -> `agentRun`, its prompt layout, its host
 * loop or JSON loop, its refusal facts and its `requires` check), over a node that offers the run's tools (`tools` subset of the node's, ruling
 * B6) and calls each through the template node's one road. A business refusal is shown to the model as a refusal; an engine failure is
 * kept and freezes the node when the loop ends; a confused model ends the node (`NodeFailedError` `confused`).
 */
const agentRunOf =
    (request: TemplateNodeRunRequest, ports: TemplateHostPorts, state: RunState) =>
    async <S extends z.ZodType>(asked: TemplateAgentRequest<S>): Promise<z.output<S>> => {
        const { node } = request
        if (node.model === undefined) throw new TemplateRunError("NODE_MODEL_MISSING", node.id)
        const held = heldToolsOf(node.tools, true)
        const undeclared = (asked.tools ?? []).find((id) => !held.includes(id))
        if (undeclared !== undefined) throw new TemplateRunError("AGENT_TOOL_UNDECLARED", undeclared)
        // The subset narrows the node's OWN tools; the default reads and the default node tools are offered always.
        const offered = [...new Set([...(asked.tools ?? node.tools), ...DEFAULT_AI_READ_TOOLS, ...DEFAULT_NODE_TOOLS])]
        const definitions = offered.map((id) => offeredToolOf(request, id))
        const done = new Set([...state.madeOk, ...(request.turn.alreadyDone ?? [])])
        const requires = (node.requires ?? []).filter((id) => offered.includes(id) && !done.has(id))
        const call = calledOf(request, ports, state, true)
        const legacyPorts: NodeHostPorts = {
            read: () => Promise.reject(new NodeRunError("TOOL_NOT_OFFERED", "data.read")),
            write: () => Promise.reject(new NodeRunError("TOOL_NOT_OFFERED", "data.write")),
            execute: (effect) => Promise.reject(new NodeRunError("EFFECT_UNDECLARED", effect.id)),
            callTool: async (tool, args) => {
                try {
                    const called = await call(trusted<ToolId>(tool.id), args)
                    const { answer } = called
                    if (answer.ok) return shownToModelOf(called)
                    throw new ToolRefusedForAgent(answer.refusal, answer.facts)
                } catch (cause) {
                    if (!(cause instanceof ToolRefusedForAgent) && state.fatal === null) state.fatal = { cause }
                    throw cause
                }
            },
            model: ports.model,
            now: ports.now,
            ...(ports.agent === undefined ? {} : { agent: ports.agent }),
        }
        const ran = await runNode(
            {
                node: agentNodeOf(request, offered, requires, asked),
                params: null,
                input: null,
                turn: request.turn,
                grant: { tools: offered },
                effects: request.effects,
                tools: new Map([...request.tools, ...definitions.map((tool): [string, ToolDefinition] => [tool.id, tool])]),
                ...(request.words === undefined ? {} : { words: request.words }),
                // The agent's calls are keyed as the node's own: one road, one key.
                key: request.key,
            },
            legacyPorts,
        )
        if (state.fatal !== null) throw state.fatal.cause
        const decision = ran.output
        if (!isDecision(decision)) throw new NodeRunError("OUTPUT_INVALID", node.id)
        if (decision.kind === "confused") {
            throw new NodeFailedError({ kind: "confused", question: decision.confusion.question }, { reason: decision.confusion.reason })
        }
        return trusted<z.output<S>>(decision.value)
    }

/** The subject of the turn as a template node reads it: the ids only. */
const subjectOf = (turn: TurnRef): TemplateSubject | null =>
    turn.subject === null ? null : { kind: turn.subject.kind, id: turn.subject.id }

/**
 * A node's failure as the engine's typed end: a confused AI is the legacy confusion (the AI core and the stop read it), "cannot" is a
 * business failure with the node's facts. The step freezes either way; a re-run runs the node again, whole.
 */
const typedEndOf = (failed: NodeFailedError): NodeConfused | NodeBusinessFailure => {
    const { reason, facts } = failed
    if (reason.kind === "confused") {
        const said = facts.reason
        return new NodeConfused({
            reason: typeof said === "string" && said !== "" ? said : (reason.question ?? "confused"),
            question: reason.question,
        })
    }
    return new NodeBusinessFailure({ code: "NODE_CANNOT", messageKey: "", message: reason.why, fields: facts })
}

/**
 * Runs one template node the way the engine must (contract C1/C4, rulings B6/B7): params and input parsed by the node's schemas;
 * `ctx.tools.call` only for a declared tool (`TOOL_UNDECLARED` otherwise), keyed `<run step>:<digest of the call>` and answered as a
 * `ToolAnswer` (a business refusal is a fact, an engine failure throws and freezes the node); `ctx.agent.run` through the legacy agent
 * loop over the run's tools, `NODE_MODEL_MISSING` on a node without a model; `ctx.run.at` the run step's fixed instant; `ctx.fail` and a
 * confused model end the node as the engine's typed end; every `requires` met by an ok call; the output parsed. A template node has no
 * data port and no effect: every call is a tool call.
 */
export const runTemplateNode = async (request: TemplateNodeRunRequest, ports: TemplateHostPorts): Promise<NodeRun> => {
    const { node } = request
    const params = parsedBy(node.params ?? NO_PARAMS, request.params, "PARAMS_INVALID", node.id)
    const input = parsedBy(node.input, request.input, "INPUT_INVALID", node.id)
    const state: RunState = { madeOk: new Set(), fatal: null }
    const context: NodeContext = {
        params,
        run: request.run,
        subject: subjectOf(request.turn),
        workspace: request.workspace,
        // The engine answers `declined` only for a tool that can ask (a read never asks): the typed `ToolAnswerOf<K>` holds.
        tools: { call: trusted<TemplateNodeTools["call"]>(callOf(request, ports, state)) },
        agent: { run: agentRunOf(request, ports, state) },
        // No agent policy values reach a node any more (the engine reads none); `NodeContext.policy` goes with ENGINE-FIX's builder types.
        policy: {},
        fail: (reason, facts): never => {
            throw new NodeFailedError(reason, facts)
        },
    }
    try {
        const raw = await node.run(input, context)
        const output = parsedBy(node.output, raw, "OUTPUT_INVALID", node.id)
        const done = new Set([...state.madeOk, ...(request.turn.alreadyDone ?? [])])
        const unmet = (node.requires ?? []).find((id) => !done.has(id))
        if (unmet !== undefined) throw new TemplateRunError("REQUIRED_CALL_MISSING", unmet)
        return { output, effects: [] }
    } catch (cause) {
        if (isNodeFailed(cause)) throw typedEndOf(cause)
        throw cause
    }
}
