import { z } from "../schema/zod-entry"
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
import {
    isRefused,
    type EffectOptions,
    type EffectPayload,
    type NodeAgentRequest,
    type NodeConfusion,
    type NodeContext,
    type NodeModelDecision,
    type NodeTools,
    type NodeQuery,
    type NodeModelRequest,
    type SubjectRef,
} from "./node.types"
import { RightsDeniedError } from "./rights-denied-error"
import { NodeBusinessFailure, NodeConfused } from "./memory"
import { ToolUndeclaredError } from "./tool-undeclared-error"
import { trusted } from "../schema/trusted"
import { callDigestOf, stableJson } from "./call-digest"

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
 * The tools a node reaches: declared, installed, named by the run's grant, never mutating from a condition, args and answer
 * parsed. Each call is keyed by the run step, the tool and its arguments, so the door can replay instead of calling again: the same
 * key an effect of the same id and arguments gets, so either road reaches the one ledger line, receipt and op key.
 */
const toolsOf = (request: NodeRunRequest, ports: NodeHostPorts): NodeTools => {
    const { node } = request
    return {
        call: async <R>(name: Namespaced, args: Readonly<Record<string, unknown>>): Promise<R> => {
            if (!(node.tools ?? []).includes(name)) throw new ToolUndeclaredError(name)
            const tool = request.tools.get(name)
            if (tool === undefined) throw new NodeRunError("TOOL_UNKNOWN", name)
            if (tool.mutates && node.role === "condition") throw new NodeRunError("TOOL_MUTATES", name)
            if (!(request.grant.tools ?? []).includes(name)) throw new RightsDeniedError(name)
            const checked = parsedRecord(tool.args, args, "TOOL_ARGS_INVALID", name)
            const key = `${request.key}:${callDigestOf(name, checked)}`
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
    "When you cannot decide without guessing (the data is missing, contradicts itself, or does not fit what you were asked): " +
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

/** One tool call of the agent: the tool's name and its arguments. */
interface AgentToolCall {
    readonly tool: string
    readonly args: Readonly<Record<string, unknown>>
}

/** How a host-run agent loop ended: its decision once the agent answered or said it is confused, null while it runs. */
interface HostLoopEnd<T> {
    decision: NodeModelDecision<T> | null
}

/** One turn of the agent, as the model answers it: a call, the output, or its confusion. */
type AgentTurn = { readonly call: AgentToolCall } | { readonly done: unknown } | { readonly confused: NodeConfusion }

/**
 * The schema of one turn. A fake scripts an agent with these very shapes, in call order:
 * `{ call: { tool: "nivo.tool.payment.order.settle", args: { orderId, transactionId } } }`, then `{ done: <the step's output> }`,
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

/** The JSON Schema of a turn, as the model is shown it: the three shapes, nothing else. */
const { $schema: _turnDialect, ...agentTurnShown } = z.toJSONSchema(agentTurnSchema, { io: "input" })

/**
 * A turn as the JSON loop asks the model port for it: any JSON object, shown to the model as the three shapes of `agentTurnSchema`
 * (a host appends this schema's JSON Schema to the instructions). The port parses with the schema it is given and may throw when the
 * answer does not fit; an answer that is a JSON object but none of the three shapes is the loop's to judge (a refused turn, never a
 * crash of the step), so the port is given a schema every JSON object fits and the loop checks the shape itself (MX-CORE DEF-2).
 */
const agentTurnAsked: z.ZodType<Readonly<Record<string, unknown>>> = z.record(z.string(), z.unknown()).meta(agentTurnShown)

/** The code of the refusal a turn that fits none of the three shapes is answered with: it costs a turn, like any refusal. */
const TURN_INVALID = "TURN_INVALID"

/** What a turn that fits none of the three shapes is told: the shapes, and what did not fit. */
const turnRefusalOf = (error: z.ZodError): NodeAgentRefusal => ({
    code: TURN_INVALID,
    message:
        `The answer was none of the three shapes {"call": ...}, {"done": <the output>} or {"confused": ...}: ${error.message}`.slice(
            0,
            REFUSAL_MAX,
        ),
})

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

/** What every agent of a turn is told about the founder's answers to the reports of other steps about the same customer. */
const DECIDED_RULE =
    "The shop's founder already answered reports about this customer (`founderDecisions`: what was asked, the founder's words, oldest first). They are the shop's decisions for this customer, in force: follow them as facts, and never tell the customer they are unconfirmed or not yet known."

/** What the agent of a step is told about bank credits for the same order that joined its run while it waited. */
const JOINED_RULE =
    "More bank credits for the same order arrived while this run waited for the founder (`creditsJoined`). They belong to this run's work: count them with the credit the run is about, and settle them together when the money is to be recorded."

/** What the agent of a step is told about the events of its run's key that arrived while the run was in flight (`run.queue`). */
const QUEUED_EVENTS_RULE =
    "More events about the same subject arrived while this run was in flight (`queuedEvents`, oldest first, each as its trigger supplied it). They were queued on this run instead of starting their own: handle them as part of this run's work."

/** What the agent of a step that runs again is told about the lines the step already sent the customer. */
const ALREADY_SENT_RULE =
    "This step already sent the customer the lines in `alreadySent` (oldest first) when it ran before. They were delivered: never say the same thing again, in the same or in other words; send a new line only when it says something new."

// ---------------------------------------------------------------------------------------------------------------------------------
// The layout of a model call (prompt caching)
//
// A provider caches the PREFIX of a prompt, so every model call of the engine is laid out from what changes least to what changes
// most, and equal data always has the same text (`stableJson`, tools in name order):
//   L1  the agent's craft: its guidance, its whole tool set with the schemas, how an agent takes its turns;
//   L2  (the shop's rules from the truth graph: not laid out by this host)
//   L3  the step: its goal, the tools it may call, the schema of its output (the host appends the schema of the answer);
//   ---- END OF THE STABLE PART: `instructions` ends here; a host that marks a cacheable prefix marks this point, and the end of
//        L1 (`sharedLength`) as well, so the first call of ANOTHER step of the same agent and shop reads that opening ----
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

/**
 * L1 of an agent whose turns the host takes itself: the guidance and how an agent acts. The tool set
 * is not in the words: the host shows it to the model its own way, from the list the runner hands over.
 */
const hostLoopCraftOf = (frame: ModelCallFrame): string => {
    const guidance = (frame.turn.guidance ?? "").trim()
    return [...(guidance === "" ? [] : [guidance]), AGENT_ACT_RULE].join("\n\n")
}

/** The stable part of a call laid out: L1 (the opening every step's call of the agent shares), then the step's own words (L3). */
interface StableLayout {
    /** L1 and L3, one blank line between them. */
    readonly instructions: string
    /** How long the L1 opening of `instructions` is; absent when the turn carries none (the call is its step alone). */
    readonly sharedLength?: number
}

/** The stable part of a call: L1, then the step's own words (L3), with where the shared opening (L1) ends. */
const stableOf = (
    frame: ModelCallFrame,
    own: ReadonlyArray<string>,
    agentTurn: boolean,
    step: string,
): StableLayout => {
    const shared = craftOf(frame, own, agentTurn).join("\n\n")
    return shared === ""
        ? { instructions: step }
        : { instructions: `${shared}\n\n${step}`, sharedLength: shared.length }
}

/**
 * A plain model call of a turn's agent laid out for the cache: the agent's craft in front of the call's
 * own instructions, when the turn carries any, with `sharedLength` saying where that shared opening ends (a host that marks cache
 * breakpoints marks there too, so every step of the agent reads it from the cache). A host uses it for a model call it makes for the
 * agent outside a node (the engine's own decision on a stuck step); the same call is returned when the turn adds nothing.
 */
export const guidedModelRequest = (frame: ModelCallFrame, model: NodeModelRequest): NodeModelRequest => {
    const laid = stableOf(frame, [], false, model.instructions)
    return laid.sharedLength === undefined
        ? model
        : { ...model, instructions: laid.instructions, sharedLength: laid.sharedLength }
}

/** The rules about what changes between two tries of a step, each only when the turn carries its data: L4, never the stable part. */
const volatileWordsOf = (turn: NodeRunRequest["turn"]): string | undefined => {
    const words = [
        ...((turn.waitingOnFounder ?? []).length === 0 ? [] : [WAITING_RULE]),
        ...((turn.founderAnswers ?? []).length === 0 ? [] : [ANSWERED_RULE]),
        ...((turn.founderDecisions ?? []).length === 0 ? [] : [DECIDED_RULE]),
        ...((turn.creditsJoined ?? []).length === 0 ? [] : [JOINED_RULE]),
        ...((turn.queue ?? []).length === 0 ? [] : [QUEUED_EVENTS_RULE]),
        ...((turn.alreadySent ?? []).length === 0 ? [] : [ALREADY_SENT_RULE]),
    ]
    return words.length === 0 ? undefined : words.join("\n\n")
}

/** What the turn knows that changes between two tries of a step, as members of the call's input; each only when the turn carries it. */
const volatileFactsOf = (turn: NodeRunRequest["turn"]): Readonly<Record<string, unknown>> => {
    const waiting = turn.waitingOnFounder ?? []
    const answers = turn.founderAnswers ?? []
    const sent = turn.alreadySent ?? []
    const decided = turn.founderDecisions ?? []
    const joined = turn.creditsJoined ?? []
    const events = turn.queue ?? []
    return {
        ...(waiting.length === 0 ? {} : { waitingOnFounder: waiting }),
        ...(answers.length === 0 ? {} : { founderAnswers: answers }),
        ...(decided.length === 0 ? {} : { founderDecisions: decided }),
        ...(joined.length === 0 ? {} : { creditsJoined: joined }),
        ...(events.length === 0 ? {} : { queuedEvents: events }),
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
const refusalOf = (cause: unknown): NodeAgentRefusal => {
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
    ):
        | { readonly ok: true; readonly value: z.output<S> }
        | { readonly ok: false; readonly refused: NodeAgentRefusal } => {
        const missing = required.filter((id) => !succeeded.has(id))
        if (missing.length > 0)
            return { ok: false, refused: { code: "REQUIRED_CALL_MISSING", message: missing.join(", ") } }
        const output = asked.output.safeParse(offered)
        if (!output.success) {
            return {
                ok: false,
                refused: { code: "OUTPUT_INVALID", message: output.error.message.slice(0, REFUSAL_MAX) },
            }
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
        const ended: HostLoopEnd<z.output<S>> = { decision: null }
        // The last output or confusion the closures refused: named in the confusion when the host's turns run out (as the JSON loop does).
        const lastRefused: { refused: NodeAgentRefusal | null } = { refused: null }
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
                if (!judged.ok) {
                    lastRefused.refused = judged.refused
                    return judged
                }
                ended.decision = { kind: "answer", value: judged.value }
                return { ok: true }
            },
            confused: (confusion) => {
                if (ended.decision !== null) return { ok: false, refused: over }
                const said = confusionSchema.safeParse(confusion)
                if (!said.success) {
                    lastRefused.refused = { code: "CONFUSION_INVALID", message: said.error.message.slice(0, REFUSAL_MAX) }
                    return { ok: false, refused: lastRefused.refused }
                }
                ended.decision = { kind: "confused", confusion: said.data }
                return { ok: true }
            },
        })
        return ended.decision ?? (lastRefused.refused === null ? exhausted : exhaustedAfter(turns, lastRefused.refused))
    }
    const { instructions, sharedLength } = stableOf(request, own, true, step)
    const calls: Array<unknown> = []
    // The last answer the loop refused (a turn of no shape, an output that did not fit): named in the confusion when the turns run out,
    // so the person the engine reports to reads why, not only that the turns ended.
    const ended: { refused: NodeAgentRefusal | null } = { refused: null }
    const take = async (left: number): Promise<NodeModelDecision<z.output<S>>> => {
        if (left === 0) return ended.refused === null ? exhausted : exhaustedAfter(turns, ended.refused)
        const answered = await ports.model.json(agentTurnAsked, {
            purpose,
            instructions,
            ...(sharedLength === undefined ? {} : { sharedLength }),
            ...(volatile === undefined ? {} : { volatile }),
            // The calls so far come last and only grow, so the text of one turn is the opening of the next turn's.
            input: { input: asked.input, ...facts, calls: [...calls], turnsLeft: left - 1 },
            ...(asked.images === undefined ? {} : { images: asked.images }),
            ...(asked.reasoning === undefined ? {} : { reasoning: asked.reasoning }),
        })
        // A JSON object that is none of the three shapes is a refused turn the model reads next (it costs a turn); when the turns run
        // out the step ends confused, as every exhausted loop does: never a throw out of the step.
        const read = agentTurnSchema.safeParse(answered)
        if (!read.success) {
            ended.refused = turnRefusalOf(read.error)
            calls.push({ turn: "refused", refused: ended.refused })
            return take(left - 1)
        }
        const turn = read.data
        if ("confused" in turn) return { kind: "confused", confusion: turn.confused }
        if ("call" in turn) {
            const { tool, args } = turn.call
            calls.push({ tool, args, ...(await call(tool, args)) })
            return take(left - 1)
        }
        const judged = done(turn.done)
        if (!judged.ok) {
            ended.refused = judged.refused
            calls.push({ done: "refused", refused: judged.refused })
            return take(left - 1)
        }
        return { kind: "answer", value: judged.value }
    }
    return take(turns)
}

/** The confusion of a JSON loop whose turns ran out after a refused answer: the turns, and the last refusal's code and words. */
const exhaustedAfter = <T>(turns: number, refused: NodeAgentRefusal): NodeModelDecision<T> => ({
    kind: "confused",
    confusion: {
        reason: `AGENT_TURNS_EXHAUSTED after ${turns} turns; the last answer was refused ${refused.code}: ${refused.message}`.slice(
            0,
            CONFUSION_MAX,
        ),
        question: null,
    },
})

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
    // One road for the node's own code and for the agent's calls: the code may post the wider `codePayload` shape of an effect (a card its
    // step built), the agent only the `payload` shape it is shown, so a model never types what only a step may build.
    const effectOf =
        (byAgent: boolean) =>
        async (kind: Namespaced, payload: EffectPayload, options: EffectOptions = {}): Promise<SubjectRef> => {
            if (!node.effects.includes(kind)) throw new NodeRunError("EFFECT_UNDECLARED", kind)
            const definition = request.effects.get(kind)
            if (definition === undefined) throw new NodeRunError("EFFECT_UNKNOWN", kind)
            const shape = byAgent ? definition.payload : (definition.codePayload ?? definition.payload)
            const checked = parsedRecord(shape, payload, "EFFECT_PAYLOAD_INVALID", kind)
            const call = { key: `${request.key}:${callDigestOf(kind, checked)}`, dedupeKey: options.dedupeKey ?? null }
            const subject = await ports.execute(definition, checked, call)
            // A refusal changed nothing: it is no effect of the step, and the host kept nothing under its key, so the call made again is really made.
            if (!isRefused(subject)) done.push({ id: kind, subject })
            return subject
        }
    const effect = effectOf(false)
    const tools = toolsOf(request, ports)
    return {
        turn: request.turn,
        params,
        data: {
            read: async <T>(kind: string, query: NodeQuery): Promise<ReadonlyArray<T>> =>
                trusted<ReadonlyArray<T>>(await ports.read(kind, query, query.scope ?? "turn")),
            write: (kind, record) => ports.write(kind, record),
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
        agent: { run: (asked) => agentRun(request, ports, { effect: effectOf(true), tools }, asked) },
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
 * Runs one node the way every host must: params and input parsed by the node's schemas, each effect declared and installed and its
 * payload parsed before the port acts, each tool declared by the node, installed and named by the run's grant before the NIVO MCP door
 * calls it, and the output parsed. A node's reach is its code: no data right is judged (`nivo-frame.rights`).
 */
export const runNode = async (request: NodeRunRequest, ports: NodeHostPorts): Promise<NodeRun> => {
    const { node } = request
    const params = parsed(node.params, request.params, "PARAMS_INVALID", node.id)
    const input = parsed(node.input, request.input, "INPUT_INVALID", node.id)
    const effects: Array<NodeRunEffect> = []
    const raw = await node.run(input, contextOf(request, ports, params, effects))
    return { output: parsed(node.output, raw, "OUTPUT_INVALID", node.id), effects }
}
