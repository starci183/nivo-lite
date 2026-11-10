import { z } from "../schema/zod-entry"
import { rightsGaps } from "../rights/rights"
import type { DataAccess, DataRight, RightScope, RightsGrant } from "../rights/rights.types"
import { isRecord } from "../schema/is-record"
import type { Namespaced } from "../schema/schema.types"
import type {
    NodeAgentCallAnswer,
    NodeAgentRefusal,
    NodeHostPorts,
    NodeRun,
    NodeRunEffect,
    NodeRunRequest,
} from "./host.types"
import { NodeRunError } from "./node-run-error"
import { isRefused } from "./node.types"
import type {
    EffectOptions,
    EffectPayload,
    NodeAgentRequest,
    NodeConfusion,
    NodeContext,
    NodeModelDecision,
    NodeTools,
    NodeQuery,
    NodeModelRequest,
    SubjectRef,
} from "./node.types"
import { RightsDeniedError } from "./rights-denied-error"
import { NodeBusinessFailure, NodeConfused } from "./memory"
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
 * The JSON of a value with the members of every object in name order (an undefined member left out), so equal data always has the
 * same text. Written here, in plain code, because this file is also built for the browser, where no Node module can be imported.
 */
const stableJson = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map((item: unknown) => stableJson(item)).join(",")}]`
    if (typeof value === "object" && value !== null) {
        return `{${Object.entries(value)
            .filter(([, member]) => member !== undefined)
            .sort(([left], [right]) => (left < right ? -1 : 1))
            .map(([name, member]) => `${JSON.stringify(name)}:${stableJson(member)}`)
            .join(",")}}`
    }
    return JSON.stringify(value) ?? "null"
}

/** The seeds and the multipliers of the two 32-bit halves of a text's digest. */
const DIGEST_SEEDS: readonly [number, number] = [0xdeadbeef, 0x41c6ce57]
const DIGEST_STEPS: readonly [number, number] = [2654435761, 1597334677]
const DIGEST_MIXES: readonly [number, number] = [2246822507, 3266489909]

/** A 32-bit half as eight hex digits. */
const hex8 = (half: number): string => (half >>> 0).toString(16).padStart(8, "0")

/**
 * The digest of a text: sixteen hex digits (64 bits) from two 32-bit halves mixed over its code units. It is no secret and guards
 * nothing: it only tells the few calls of one step apart, the same on every host, with no Node module.
 */
const textDigestOf = (text: string): string => {
    let [first, second] = DIGEST_SEEDS
    for (let index = 0; index < text.length; index += 1) {
        const unit = text.charCodeAt(index)
        first = Math.imul(first ^ unit, DIGEST_STEPS[0])
        second = Math.imul(second ^ unit, DIGEST_STEPS[1])
    }
    const mixedFirst =
        Math.imul(first ^ (first >>> 16), DIGEST_MIXES[0]) ^ Math.imul(second ^ (second >>> 13), DIGEST_MIXES[1])
    const mixedSecond =
        Math.imul(second ^ (second >>> 16), DIGEST_MIXES[0]) ^ Math.imul(first ^ (first >>> 13), DIGEST_MIXES[1])
    return `${hex8(mixedSecond)}${hex8(mixedFirst)}`
}

/**
 * What tells one call of a step from another: the tool or effect and its parsed arguments, whatever their member order. A step that
 * runs again makes its calls in whatever order its agent chooses, so the place of a call says nothing: a replay must only ever answer
 * the same tool asked the same thing.
 */
export const callDigestOf = (id: string, args: Readonly<Record<string, unknown>>): string =>
    textDigestOf(stableJson([id, args]))

/**
 * The tools a node reaches: declared, installed, granted by name and by right, never mutating from a condition, args and answer
 * parsed. Each call is keyed by the run step, the tool and its arguments, so the door can replay instead of calling again.
 */
const toolsOf = (request: NodeRunRequest, ports: NodeHostPorts): NodeTools => {
    const { node } = request
    return {
        call: async <R>(name: Namespaced, args: Readonly<Record<string, unknown>>): Promise<R> => {
            if (!(node.tools ?? []).includes(name)) throw new ToolUndeclaredError(name)
            const tool = request.tools.get(name)
            if (tool === undefined) throw new NodeRunError("TOOL_UNKNOWN", name)
            if (tool.mutates && node.role === "condition") throw new NodeRunError("TOOL_MUTATES", name)
            const named = (request.grant.tools ?? []).includes(name)
            if (!named || rightsGaps(request.grant, tool.rights).length > 0) throw new RightsDeniedError(name)
            const checked = parsedRecord(tool.args, args, "TOOL_ARGS_INVALID", name)
            const key = `${request.key}:tool:${callDigestOf(name, checked)}`
            return trusted<R>(
                parsed(tool.result, await ports.callTool(tool, checked, key), "TOOL_RESULT_INVALID", name),
            )
        },
    }
}

/** The longest reason or question an AI gives when it is confused. */
const CONFUSION_MAX = 2000

/** What `decide` adds to a node's own instructions: the way out of guessing. */
const DECIDE_RULE =
    'Answer ONLY with JSON, in one of two shapes. When you can decide from what you are given: {"answer": <the answer described above>}. ' +
    'When you cannot decide without guessing (the data is missing, contradicts itself, or does not fit what you were asked): ' +
    '{"confused": {"reason": "<why you cannot decide, plainly>", "question": "<what a person must answer for you to go on, or null>"}}. ' +
    "Never guess to avoid the second shape."

/** The schema of a `decide` answer: the node's own schema under `answer`, or the confusion. */
const decisionSchemaOf = <S extends z.ZodType>(
    schema: S,
): z.ZodType<{ readonly confused: NodeConfusion } | { readonly answer: z.output<S> }> =>
    // The union is exactly this type; zod cannot say so for a schema it only knows as `S`.
    trusted<z.ZodType<{ readonly confused: NodeConfusion } | { readonly answer: z.output<S> }>>(decisionUnionOf(schema))

const decisionUnionOf = (schema: z.ZodType): z.ZodType =>
    z.union([
        z.object({
            confused: z.object({
                reason: z.string().min(1).max(CONFUSION_MAX),
                question: z.string().max(CONFUSION_MAX).nullable(),
            }),
        }),
        z.object({ answer: schema }),
    ])

// ---------------------------------------------------------------------------------------------------------------------------------
// The agent of a step
// ---------------------------------------------------------------------------------------------------------------------------------

/** The turns an agent takes when the node names none, and the most it may ask for. */
const AGENT_TURNS = 6
const AGENT_TURNS_MAX = 12

/** The longest text of a refusal handed back to the agent. */
const REFUSAL_MAX = 500

/** A confusion as the model may say it: a reason, and what a person must answer or null. */
const confusionSchema: z.ZodType<NodeConfusion> = z.object({
    reason: z.string().min(1).max(CONFUSION_MAX),
    question: z.string().max(CONFUSION_MAX).nullable(),
})

/** One turn of the agent, as the model answers it: a call, the output, or its confusion. */
type AgentTurn =
    | { readonly call: { readonly tool: string; readonly args: Readonly<Record<string, unknown>> } }
    | { readonly done: unknown }
    | { readonly confused: NodeConfusion }

/**
 * The schema of one turn. A fake scripts an agent with these very shapes, in call order:
 * `{ call: { tool: "nivo.payment.order.settle", args: { orderId, transactionId } } }`, then `{ done: <the step's output> }`,
 * or `{ confused: { reason, question } }`.
 */
const agentTurnSchema: z.ZodType<AgentTurn> = z.union([
    z.object({ call: z.object({ tool: z.string().min(1).max(200), args: z.record(z.string(), z.unknown()) }) }),
    z.object({
        confused: z.object({
            reason: z.string().min(1).max(CONFUSION_MAX),
            question: z.string().max(CONFUSION_MAX).nullable(),
        }),
    }),
    z.object({ done: z.unknown() }),
])

/** How an agent takes its turns: part of the agent's craft, the same words for every step of every agent. */
const AGENT_RULE =
    "You act by calling tools; you never claim an action you did not call a tool for. Each turn answer ONLY with JSON, one of three shapes. " +
    'To call one tool the step allows: {"call": {"tool": "<name>", "args": {<arguments fitting that tool\'s schema>}}}. You then see its result, or why it was refused, in `calls`: a refusal is a fact, never retry the same call unchanged, never work around it. ' +
    'When the goal is reached: {"done": <the output, fitting the step\'s `outputSchema`>}. Every tool the step lists as `required` must have succeeded before that. ' +
    'When you cannot reach the goal without guessing: {"confused": {"reason": "<why, plainly>", "question": "<what a person must answer, or null>"}}. ' +
    "Never type an amount, a total, a name or any fact that is not in what you are given or in a tool's result: tools take ids and work the rest out themselves."

/**
 * How an agent acts when the host takes its turns (`NodeHostPorts.agent`): the part of `AGENT_RULE` that is about acting, without the
 * JSON shapes of a turn, which are then the host's own. Part of the agent's craft, the same words for every step of every agent.
 */
const AGENT_ACT_RULE =
    "You act by calling tools; you never claim an action you did not call a tool for. A step may call only the tools it names; any other is refused there. " +
    "Call one tool per turn: a second call in the same turn is refused and costs a turn. " +
    "You see the result of each call, or why it was refused: a refusal is a fact, never retry the same call unchanged, never work around it. " +
    "Every tool the step lists as `required` must have succeeded before you give the step's output, which must fit its `outputSchema`. " +
    "When you cannot reach the goal without guessing, say so with the reason and what a person must answer. " +
    "Never type an amount, a total, a name or any fact that is not in what you are given or in a tool's result: tools take ids and work the rest out themselves."

/** What goes before the agent's tool set: the whole set is always shown, and a step may call only the ones it names. */
const TOOLS_RULE =
    "Every tool of this agent, by name, with what it does and the schema of its arguments (JSON). A step may call only the tools it names; any other is refused there. " +
    "Within one schema a description is written once: it holds for every later member of the same name."

/** What goes before the frame of a step: what it may call, what must have succeeded, and the shape of its output. */
const STEP_RULE =
    "This step, as JSON: the tools it may call (`tools`, by name), the tools that must have succeeded before its output (`required`), and the schema of its output (`outputSchema`)."

/** What every agent of a turn is told while something of its customer waits for the founder: a limit on its words, never a script. */
const WAITING_RULE =
    "Something of this customer waits for the shop's founder (`waitingOnFounder`). About it you may only tell the customer that the shop is checking and will come back: never confirm, promise or deny a payment, a refund or a delivery. Everything else you serve as usual, and a customer message that has no answer yet gets one."

/** What the agent of a step that runs again is told about the founder's answer to its earlier report. */
const ANSWERED_RULE =
    "The shop's founder answered what this step asked before (`founderAnswers`, oldest first). Their answer is a fact and a decision: follow it. It still cannot make a tool do what the tool refuses."

/** What the agent of a step that runs again is told about the lines the step already sent the customer. */
const ALREADY_SENT_RULE =
    "This step already sent the customer the lines in `alreadySent` (oldest first) when it ran before. They were delivered: never say the same thing again, in the same or in other words; send a new line only when it says something new."

/** What goes before the values of the agent's policy: they are facts, and they are the workspace's own. */
const POLICY_RULE =
    "The values of this policy as they stand for this shop (JSON, by name). They are facts: where the words above name a default, the value here is the one that holds."

// ---------------------------------------------------------------------------------------------------------------------------------
// The layout of a model call (prompt caching)
//
// A provider caches the PREFIX of a prompt, so every model call of the engine is laid out from what changes least to what changes
// most, and equal data always has the same text (`stableJson`, tools in name order):
//   L1  the agent's craft: the guidance of its policy, its whole tool set with the schemas, how an agent takes its turns;
//   L2  the shop's policy values;
//   L3  the step: its goal, the tools it may call, the schema of its output (the host appends the schema of the answer);
//   ---- END OF THE STABLE PART: `instructions` ends here; a host that marks a cacheable prefix marks this point ----
//   L4  what changes from call to call: `volatile` (the rules about what waits, what was answered, what was sent) and `input`
//       (the thread, the facts, the calls so far).
// Nothing of L4 may enter `instructions`: no clock, no run, lead or record id, no member order that depends on how an object was
// built. The calls of one step only ever grow at the end of `input`: an earlier call is never rewritten or dropped.
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * What laying a model call out needs of the run: the turn, the installed effects and tools the agent's set is read from, and the
 * words of the install's text keys.
 */
export type ModelCallFrame = Pick<NodeRunRequest, "turn" | "effects" | "tools" | "words">

/** A tool as the agent is shown it. */
interface OfferedTool {
    readonly name: string
    readonly does: unknown
    readonly argsSchema: unknown
}

const jsonSchemaOf = (schema: z.ZodType): unknown => {
    try {
        return z.toJSONSchema(schema)
    } catch {
        return null
    }
}

/**
 * A schema as the agent reads it, with what says nothing twice left out: a description already given in the same schema is not
 * repeated (a union states the words of a member every branch has once, in its first branch), walked in the member order the text
 * is written in so the first one is the one kept.
 */
const withoutRepeats = (value: unknown, said: Set<string>): unknown => {
    if (Array.isArray(value)) return value.map((item: unknown) => withoutRepeats(item, said))
    if (!isRecord(value)) return value
    const kept: Record<string, unknown> = {}
    for (const [name, member] of Object.entries(value).sort(([left], [right]) => (left < right ? -1 : 1))) {
        if (name === "description" && typeof member === "string") {
            if (said.has(member)) continue
            said.add(member)
        }
        kept[name] = withoutRepeats(member, said)
    }
    return kept
}

/** A JSON Schema without the address of its dialect (`$schema`), which says nothing to a model and would be repeated by every schema. */
const withoutDialect = (json: unknown): unknown => {
    if (!isRecord(json)) return json
    const { $schema: _dialect, ...own } = json
    return own
}

/**
 * The schema of a tool's arguments as the agent is shown it: the JSON Schema without the dialect address every schema would repeat
 * (`$schema`) and without a description said twice. Nothing a call is checked against is shown differently: the runner parses the
 * arguments with the tool's own schema.
 */
const argsSchemaOf = (schema: z.ZodType): unknown => withoutRepeats(withoutDialect(jsonSchemaOf(schema)), new Set())

/**
 * What a tool does, in words the model can read: owner words as they are, and the words of a text key (the install's `words`),
 * never the bare key, which says nothing; a key the install has no words for stays as the key.
 */
const doesOf = (frame: ModelCallFrame, title: unknown): unknown => {
    const key: unknown = isRecord(title) ? title.key : undefined
    return typeof key === "string" ? (frame.words?.(key) ?? key) : title
}

/**
 * The whole tool set of the turn's agent, in name order, each with its arguments' schema: the set its module declares (`agentTools`),
 * or the step's own declarations when the turn names none. It is what the agent is SHOWN, the same for every step so the text is the
 * same; what a step may CALL is its own declarations alone, checked by the runner at each call.
 */
const agentToolsOf = (frame: ModelCallFrame, own: ReadonlyArray<string>): ReadonlyArray<OfferedTool> =>
    [...new Set(frame.turn.agentTools ?? own)]
        .sort((left, right) => (left < right ? -1 : 1))
        .flatMap((id) => {
            const effect = frame.effects.get(id)
            if (effect !== undefined) {
                return [{ name: id, does: doesOf(frame, effect.title), argsSchema: argsSchemaOf(effect.payload) }]
            }
            const tool = frame.tools.get(id)
            return tool === undefined
                ? []
                : [{ name: id, does: doesOf(frame, tool.title), argsSchema: argsSchemaOf(tool.args) }]
        })

/** L1, the agent's craft: its guidance, its tool set, and for an agent's turn how turns are taken. Nothing when the agent has none. */
const craftOf = (frame: ModelCallFrame, own: ReadonlyArray<string>, agentTurn: boolean): ReadonlyArray<string> => {
    const guidance = (frame.turn.guidance ?? "").trim()
    const tools = agentToolsOf(frame, own)
    return [
        ...(guidance === "" ? [] : [guidance]),
        ...(tools.length === 0 ? [] : [`${TOOLS_RULE}\n${stableJson(tools)}`]),
        ...(agentTurn ? [AGENT_RULE] : []),
    ]
}

/** L2, the shop's policy values; nothing when the turn carries none. */
const shopOf = (turn: NodeRunRequest["turn"]): ReadonlyArray<string> => {
    const values = turn.policy ?? {}
    return Object.keys(values).length === 0 ? [] : [`${POLICY_RULE}\n${stableJson(values)}`]
}

/**
 * L1 + L2 of an agent whose turns the host takes itself: the guidance, how an agent acts, and the shop's policy values. The tool set
 * is not in the words: the host shows it to the model its own way, from the list the runner hands over.
 */
const hostLoopCraftOf = (frame: ModelCallFrame): string => {
    const guidance = (frame.turn.guidance ?? "").trim()
    return [...(guidance === "" ? [] : [guidance]), AGENT_ACT_RULE, ...shopOf(frame.turn)].join("\n\n")
}

/** The stable part of a call: L1, L2, then the step's own words (L3). */
const stableOf = (
    frame: ModelCallFrame,
    own: ReadonlyArray<string>,
    agentTurn: boolean,
    step: string,
): string => [...craftOf(frame, own, agentTurn), ...shopOf(frame.turn), step].join("\n\n")

/**
 * A plain model call of a turn's agent laid out for the cache: the agent's craft and the shop's policy values in front of the call's
 * own instructions, when the turn carries any. A host uses it for a model call it makes for the agent outside a node (the engine's
 * own decision on a stuck step); the same call is returned when the turn adds nothing.
 */
export const guidedModelRequest = (frame: ModelCallFrame, model: NodeModelRequest): NodeModelRequest => {
    const instructions = stableOf(frame, [], false, model.instructions)
    return instructions === model.instructions ? model : { ...model, instructions }
}

/** The rules about what changes between two tries of a step, each only when the turn carries its data: L4, never the stable part. */
const volatileWordsOf = (turn: NodeRunRequest["turn"]): string | undefined => {
    const words = [
        ...((turn.waitingOnFounder ?? []).length === 0 ? [] : [WAITING_RULE]),
        ...((turn.founderAnswers ?? []).length === 0 ? [] : [ANSWERED_RULE]),
        ...((turn.alreadySent ?? []).length === 0 ? [] : [ALREADY_SENT_RULE]),
    ]
    return words.length === 0 ? undefined : words.join("\n\n")
}

/** What the turn knows that changes between two tries of a step, as members of the call's input; each only when the turn carries it. */
const volatileFactsOf = (turn: NodeRunRequest["turn"]): Readonly<Record<string, unknown>> => {
    const waiting = turn.waitingOnFounder ?? []
    const answers = turn.founderAnswers ?? []
    const sent = turn.alreadySent ?? []
    return {
        ...(waiting.length === 0 ? {} : { waitingOnFounder: waiting }),
        ...(answers.length === 0 ? {} : { founderAnswers: answers }),
        ...(sent.length === 0 ? {} : { alreadySent: sent }),
    }
}

/**
 * The one refusal of a tool that satisfies a required call: the host answers it when the step, in an earlier attempt of the same stop,
 * already did what the call asks (told the customer) and must not do it a second time. The call still reads as refused to the agent;
 * only the `requires` check takes it as done, so the step can end. Every other refusal leaves a required call unmet.
 */
const ALREADY_DONE_FOR_STOP = "already_told_for_this_stop"

/** A tool's own refusal on its way back to the agent: the reason and the true values the tool gave with it. */
class ToolRefused extends Error {
    readonly code: string
    readonly params: Readonly<Record<string, unknown>>

    constructor(subject: SubjectRef) {
        super(subject.id)
        this.code = subject.id
        this.params = subject.facts ?? {}
    }
}

/** Why a call or an answer was refused, as the fact the agent reads: a stable code and bounded words. */
const refusalOf = (cause: unknown): { readonly code: string; readonly message: string; readonly data?: unknown } => {
    const code: unknown = typeof cause === "object" && cause !== null ? Reflect.get(cause, "code") : undefined
    const params: unknown = typeof cause === "object" && cause !== null ? Reflect.get(cause, "params") : undefined
    return {
        code: typeof code === "string" ? code : "CALL_FAILED",
        message: (cause instanceof Error ? cause.message : String(cause)).slice(0, REFUSAL_MAX),
        ...(isRecord(params) && Object.keys(params).length > 0 ? { data: params } : {}),
    }
}

/** The ports of the context an agent's calls go through: the very ones a node's own code uses. */
interface AgentHands {
    readonly effect: NodeContext["effect"]
    readonly tools: NodeTools
}

/**
 * The agent loop of `context.agent.run`: the model takes turns over the host's structured call until it gives an output that stands,
 * says it is confused, or runs out of turns (which is confusion too). A call of a declared effect or tool is dispatched through the
 * context, so every check of the runner applies and its key is the runner's; whatever it throws is handed back as a refusal.
 */
const agentRun = async <S extends z.ZodType>(
    request: NodeRunRequest,
    ports: NodeHostPorts,
    hands: AgentHands,
    asked: NodeAgentRequest<S>,
): Promise<NodeModelDecision<z.output<S>>> => {
    const { node } = request
    const own = [...node.effects, ...(node.tools ?? [])]
    const required = node.requires ?? []
    // The stable part of every turn of this step: the same text from the first turn to the last.
    const frame = { tools: own, required, outputSchema: withoutDialect(jsonSchemaOf(asked.output)) }
    // What this run + step already did before its stop (the engine's `alreadyDone`, from the ledger) is met already: never asked twice.
    const succeeded = new Set<string>(request.turn.alreadyDone ?? [])
    const turns = Math.max(1, Math.min(Math.trunc(asked.maxTurns ?? AGENT_TURNS), AGENT_TURNS_MAX))
    const dispatch = async (
        name: string,
        args: Readonly<Record<string, unknown>>,
    ): Promise<{ readonly subject: SubjectRef } | { readonly result: unknown }> => {
        const effect = node.effects.find((id) => id === name)
        if (effect !== undefined) {
            const subject = await hands.effect(effect, args)
            if (isRefused(subject)) throw new ToolRefused(subject)
            return { subject }
        }
        const tool = (node.tools ?? []).find((id) => id === name)
        if (tool !== undefined) return { result: await hands.tools.call(tool, args) }
        throw new NodeRunError("TOOL_NOT_OFFERED", name)
    }
    // One call of the agent, as the fact the model reads next: what it came to, or why it was refused. It throws nothing.
    const call = async (tool: string, args: Readonly<Record<string, unknown>>): Promise<NodeAgentCallAnswer> => {
        try {
            const got = await dispatch(tool, args)
            succeeded.add(tool)
            return { ok: true, ...got }
        } catch (cause) {
            // The step did this for the same stop in an earlier attempt and may not do it twice: what it requires is done.
            if (cause instanceof ToolRefused && cause.code === ALREADY_DONE_FOR_STOP) succeeded.add(tool)
            return { ok: false, refused: refusalOf(cause) }
        }
    }
    // The output the agent offers: taken once every required call succeeded and it fits the step's schema, else refused with why.
    const done = (
        offered: unknown,
    ): { readonly ok: true; readonly value: z.output<S> } | { readonly ok: false; readonly refused: NodeAgentRefusal } => {
        const missing = required.filter((id) => !succeeded.has(id))
        if (missing.length > 0) return { ok: false, refused: { code: "REQUIRED_CALL_MISSING", message: missing.join(", ") } }
        const output = asked.output.safeParse(offered)
        if (!output.success) {
            return { ok: false, refused: { code: "OUTPUT_INVALID", message: output.error.message.slice(0, REFUSAL_MAX) } }
        }
        return { ok: true, value: output.data }
    }
    const exhausted: NodeModelDecision<z.output<S>> = {
        kind: "confused",
        confusion: { reason: `AGENT_TURNS_EXHAUSTED after ${turns} turns`, question: null },
    }
    const purpose = `${node.id}:${asked.purpose ?? "agent"}`
    const step = `${asked.goal}\n\n${STEP_RULE}\n${stableJson(frame)}`
    const volatile = volatileWordsOf(request.turn)
    const facts = volatileFactsOf(request.turn)
    if (ports.agent !== undefined) {
        // The host takes the turns (a native tool-calling loop); the closures above stay the only way a call acts or an output stands.
        const ended: { decision: NodeModelDecision<z.output<S>> | null } = { decision: null }
        const over: NodeAgentRefusal = { code: "STEP_ENDED", message: "The step's agent has already ended." }
        await ports.agent({
            purpose,
            instructions: hostLoopCraftOf(request),
            step,
            ...(volatile === undefined ? {} : { volatile }),
            input: { input: asked.input, ...facts },
            tools: agentToolsOf(request, own),
            ...(asked.images === undefined ? {} : { images: asked.images }),
            ...(asked.reasoning === undefined ? {} : { reasoning: asked.reasoning }),
            maxTurns: turns,
            call: (name, args) => {
                if (ended.decision !== null) return Promise.resolve({ ok: false, refused: over })
                if (!isRecord(args)) {
                    return Promise.resolve({
                        ok: false,
                        refused: { code: "TOOL_ARGS_INVALID", message: "The arguments of a call are one JSON object." },
                    })
                }
                return call(name, args)
            },
            done: (offered) => {
                if (ended.decision !== null) return { ok: false, refused: over }
                const judged = done(offered)
                if (!judged.ok) return judged
                ended.decision = { kind: "answer", value: judged.value }
                return { ok: true }
            },
            confused: (confusion) => {
                if (ended.decision !== null) return { ok: false, refused: over }
                const said = confusionSchema.safeParse(confusion)
                if (!said.success) {
                    return {
                        ok: false,
                        refused: { code: "CONFUSION_INVALID", message: said.error.message.slice(0, REFUSAL_MAX) },
                    }
                }
                ended.decision = { kind: "confused", confusion: said.data }
                return { ok: true }
            },
        })
        return ended.decision ?? exhausted
    }
    const instructions = stableOf(request, own, true, step)
    const calls: Array<unknown> = []
    const take = async (left: number): Promise<NodeModelDecision<z.output<S>>> => {
        if (left === 0) return exhausted
        const turn = await ports.model.json(agentTurnSchema, {
            purpose,
            instructions,
            ...(volatile === undefined ? {} : { volatile }),
            // The calls so far come last and only grow, so the text of one turn is the opening of the next turn's.
            input: { input: asked.input, ...facts, calls: [...calls], turnsLeft: left - 1 },
            ...(asked.images === undefined ? {} : { images: asked.images }),
            ...(asked.reasoning === undefined ? {} : { reasoning: asked.reasoning }),
        })
        if ("confused" in turn) return { kind: "confused", confusion: turn.confused }
        if ("call" in turn) {
            const { tool, args } = turn.call
            calls.push({ tool, args, ...(await call(tool, args)) })
            return take(left - 1)
        }
        const judged = done(turn.done)
        if (!judged.ok) {
            calls.push({ done: "refused", refused: judged.refused })
            return take(left - 1)
        }
        return { kind: "answer", value: judged.value }
    }
    return take(turns)
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
        ...guidedModelRequest(request, model),
        purpose: `${node.id}:${model.purpose}`,
    })
    const effect = async (kind: Namespaced, payload: EffectPayload, options: EffectOptions = {}): Promise<SubjectRef> => {
        if (!node.effects.includes(kind)) throw new NodeRunError("EFFECT_UNDECLARED", kind)
        const definition = request.effects.get(kind)
        if (definition === undefined) throw new NodeRunError("EFFECT_UNKNOWN", kind)
        const checked = parsedRecord(definition.payload, payload, "EFFECT_PAYLOAD_INVALID", kind)
        if (rightsGaps(request.grant, definition.rights).length > 0) throw new RightsDeniedError(kind)
        const call = { key: `${request.key}:${callDigestOf(kind, checked)}`, dedupeKey: options.dedupeKey ?? null }
        const subject = await ports.execute(definition, checked, call)
        // A refusal changed nothing: it is no effect of the step, and the host kept nothing under its key, so the call made again is really made.
        if (!isRefused(subject)) done.push({ id: kind, subject })
        return subject
    }
    const tools = toolsOf(request, ports)
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
        effect,
        model: {
            text: (model) => ports.model.text(purpose(model)),
            json: (schema, model) => ports.model.json(schema, purpose(model)),
            decide: async (schema, model) => {
                const asked = purpose({ ...model, instructions: `${model.instructions}\n\n${DECIDE_RULE}` })
                const got = await ports.model.json(decisionSchemaOf(schema), asked)
                return "confused" in got
                    ? { kind: "confused", confusion: got.confused }
                    : { kind: "answer", value: got.answer }
            },
        },
        tools,
        agent: { run: (asked) => agentRun(request, ports, { effect, tools }, asked) },
        fail: (failure) => {
            throw new NodeBusinessFailure(failure)
        },
        confused: (confusion) => {
            throw new NodeConfused(confusion)
        },
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
