import type { z } from "../schema/zod-entry"
import type { JsonObject, Namespaced, SpecText } from "../schema/schema.types"
import type { LeadFact, Sensitivity, StepFailure } from "./memory.contracts"

/** The role of a step in an agent's graph. */
export type NodeRole = "trigger" | "condition" | "execute" | "output"

/** The record a turn is about. */
export interface SubjectRef {
    /** The data kind of the record, such as an order or a person. */
    readonly kind: string
    /** The id of the record within its kind. */
    readonly id: string
    /** The true values the tool read or wrote beside the subject (amounts from the records), when it answers any. */
    readonly facts?: Readonly<Record<string, unknown>> | undefined
}

/**
 * The kind of the subject a tool answers when it REFUSES (a guard held, the books say no): `{ kind: "refused", id: "<reason>",
 * facts }`. A refusal is an answer, never a throw: the agent reads it as a fact, it never satisfies a required call, it is not kept
 * as an effect of the step, and the host's ledger never keeps it, so the same call asked again later is really made again.
 */
export const REFUSED_KIND = "refused"

/** Whether a tool's answer is a refusal. */
export const isRefused = (subject: SubjectRef): boolean => subject.kind === REFUSED_KIND

/** The turn a node runs in. */
export interface TurnRef {
    /** The id of the turn, unique per run of the agent. */
    readonly turnId: string
    /** The workspace the turn belongs to, which scopes every read and write. */
    readonly workspaceId: string
    /** The agent running the turn, whose grant bounds what nodes may touch. */
    readonly agentId: string
    /** The record the turn is about, or null when the turn has none. */
    readonly subject: SubjectRef | null
    /**
     * What of the turn's customer waits for the shop's founder (a workflow that stopped: the step, since when); absent or empty when
     * nothing does. The runner tells every agent of the turn, with the one rule that goes with it: about what waits, the customer
     * may only hear that the shop is checking.
     */
    readonly waitingOnFounder?: ReadonlyArray<{ readonly step: string; readonly since: string }> | undefined
    /**
     * What the shop's founder answered, in the team chat, to the report of this very step when it could not complete before (oldest
     * first); absent on a first try. The runner hands it to the step's agent as a fact to follow.
     */
    readonly founderAnswers?: ReadonlyArray<{ readonly text: string; readonly at: string }> | undefined
    /**
     * What the shop's founder decided for the turn's customer when answering the reports of OTHER steps or runs (oldest first): the
     * question each report asked and the founder's words, read from the customer's stops (open, or resolved within a day), the one memory
     * of the customer across runs. Absent when there is none. The runner hands them to every agent of the turn as decisions of the shop
     * for this customer, in force, so a later or replayed turn never contradicts what the founder said.
     */
    readonly founderDecisions?:
        | ReadonlyArray<{ readonly question: string; readonly answer: string; readonly at: string }>
        | undefined
    /**
     * Bank credits that arrived for the same order while the run waited for the founder, joined to this run instead of opening a run of
     * their own (oldest first): the credit's id, its amount and transfer content as the bank gave them, and when it arrived. Absent when
     * none did. The runner hands them to the step's agent as facts to settle with the credit the run is about.
     */
    readonly creditsJoined?:
        | ReadonlyArray<{
              readonly transactionId: string
              readonly amountVnd: number | null
              readonly reference: string | null
              readonly at: string
          }>
        | undefined
    /**
     * The run's QUEUE as this step took it: every event with the run's correlation key that arrived while the run was in flight (busy in
     * a step, parked at a wait or held at a stop) and that no earlier step took, oldest first, each the trigger scope its event supplied.
     * The engine records the snapshot with the step, so a re-run of the step is handed the same events and none is delivered twice or
     * lost. The host hands them to a template node as `ctx.run.queue`. Absent when the step took none.
     */
    readonly queue?: ReadonlyArray<JsonObject> | undefined
    /**
     * How many events of the run's subject wait for the run as stored rows, counted once at the start of the step attempt (fixed for it);
     * the host hands it to a template node as `ctx.run.waiting`. Absent: 0.
     */
    readonly waiting?: number | undefined
    /**
     * How the agent of the turn is asked to work: the guidance its module's craft holds (tone, what to offer, what never to promise), in
     * the words of whoever wrote the craft. The runner puts it into the instructions of every model call of the turn.
     */
    readonly guidance?: string | undefined
    /**
     * Every effect and tool id the turn's agent may ever use, as its module declares it. The runner shows the agent this whole set in
     * every model call (in name order, so the text is the same from step to step); a step still calls only what it declares.
     * Absent: the step's own declarations are shown.
     */
    readonly agentTools?: ReadonlyArray<string> | undefined
    /**
     * The lines this very step already sent the customer in an earlier try (oldest first); absent on a first try. The runner hands
     * them to the step's agent so it does not say them again.
     */
    readonly alreadySent?: ReadonlyArray<{ readonly text: string; readonly at: string }> | undefined
    /**
     * The effect and tool ids THIS run + step already did in an earlier visit of the same stop (from the effect ledger), when it runs
     * again after the founder's answer; absent otherwise. Never another run's. The runner counts each as a required call already
     * met, so a step that told the customer before its stop can end without telling them a second time.
     */
    readonly alreadyDone?: ReadonlyArray<string> | undefined
}

/** `turn`: only records the turn's subject is linked to; `workspace`: any record of the kind. */
export type ReadScope = "turn" | "workspace"

/**
 * What one run of a node may reach besides its own code: the NIVO MCP tools named by the run's grant (default deny). There is no data
 * right: a node's reach is what its code declares (`nivo-frame.rights`).
 */
export interface NodeGrant {
    /** The NIVO MCP tools it may call, by name; none when absent. */
    readonly tools?: ReadonlyArray<string> | undefined
}

/** A query a node runs through its data port. */
export interface NodeQuery {
    /** Equality filters by field; absent reads every row the scope reaches. */
    readonly where?: Readonly<Record<string, string | number | boolean>>
    /** The fields to return. */
    readonly fields: ReadonlyArray<string>
    /** How far the read reaches, as the node's code states it; `turn` when absent. */
    readonly scope?: ReadScope | undefined
    /** The most rows to return; the host applies its own cap when absent. */
    readonly limit?: number
}

/** The port through which a node reads and writes records of the installed data kinds. */
export interface NodeData {
    /** Reads rows of a data kind within the query's scope. */
    readonly read: <T>(kind: string, query: NodeQuery) => Promise<ReadonlyArray<T>>
    /** Writes one record of a data kind and answers the subject it created or changed. */
    readonly write: (kind: string, record: Readonly<Record<string, unknown>>) => Promise<SubjectRef>
}

/** What an effect carries; the effect's own schema judges it. */
export type EffectPayload = Readonly<Record<string, unknown>>

/** One call of the model: what it is for (a short kebab tag, metered under the node's namespace), how to answer, and on what. */
export interface NodeModelRequest {
    /** A short kebab tag that names why the call is made, used to meter it. */
    readonly purpose: string
    /**
     * How the model should answer, in the words of the node author. It is the STABLE part of the call, the prefix a provider caches:
     * the same text for the same agent, shop and step, with nothing that changes from call to call in it (no time, no id).
     */
    readonly instructions: string
    /**
     * How long the opening of `instructions` is that every call of the turn's agent shares, byte for byte, whatever the step (L1, the
     * agent's craft and tool set); the rest, after a blank line, is the step's own (L3). Set by the
     * host's layout (`guidedModelRequest`), never by a node: a host that marks cache breakpoints marks the end of this opening too,
     * so a step's first call reads it from the cache another step wrote. Absent when the call has no shared opening.
     */
    readonly sharedLength?: number | undefined
    /**
     * Words that hold for this call only (what waits, what was answered, what was already sent): the host puts them after the
     * stable part, never inside it. Absent when the call has none.
     */
    readonly volatile?: string | undefined
    /** What the model works on, passed as data after the instructions. */
    readonly input: unknown
    /** Pictures the model should look at, as short-lived addresses the model host can fetch; none when absent. */
    readonly images?: ReadonlyArray<string> | undefined
    /**
     * How hard a reasoning model should think on this call, when the node's author knows better than the host's default: `off`
     * for a call that only fills a form, `medium` or `high` for one that weighs evidence (money, a disputed fact). Absent: the
     * host's default for node calls. It bounds what the model spends on thinking nobody reads, never what the node may do.
     */
    readonly reasoning?: "off" | "low" | "medium" | "high" | undefined
}

/** What the AI of a node says when it cannot decide: why, in its own words, and what it needs a person to answer. */
export interface NodeConfusion {
    /** Why it cannot decide, in the AI's own words. */
    readonly reason: string
    /** The question a person's answer would settle, or null when it has none to ask. */
    readonly question: string | null
}

/** What a `decide` call answers: the structured answer, or the AI saying it is confused instead of guessing. */
export type NodeModelDecision<T> =
    | { readonly kind: "answer"; readonly value: T }
    | { readonly kind: "confused"; readonly confusion: NodeConfusion }

/** The model as a host supplies it: the two calls every host implements. */
export interface NodeHostModel {
    /** A free-text answer. */
    readonly text: (request: NodeModelRequest) => Promise<string>
    /** A structured answer, parsed by the schema. */
    readonly json: <S extends z.ZodType>(schema: S, request: NodeModelRequest) => Promise<z.output<S>>
}

/** The model as a node reaches it: through the host's metered path, never a provider of its own. */
export interface NodeModel extends NodeHostModel {
    /**
     * A structured answer the AI may decline: it answers by the schema, or says it is confused (why, and what it needs answered)
     * instead of guessing. The runner adds that way out to the instructions and to the schema itself, so a node writes only its own
     * instructions. A node that gets `confused` ends its step with `return context.confused(decision.confusion)`.
     */
    readonly decide: <S extends z.ZodType>(schema: S, request: NodeModelRequest) => Promise<NodeModelDecision<z.output<S>>>
}

/**
 * What a step asks its agent for: the goal in the words of the node author, what it works on, and the schema of the output the step
 * returns. The agent reaches exactly the effects and tools the node declared, nothing else.
 */
export interface NodeAgentRequest<S extends z.ZodType = z.ZodType> {
    /** What the step must achieve, and how to behave while doing it, in the words of the node author. */
    readonly goal: string
    /** What the agent works on (ids, the customer's words, what earlier steps found), passed as data after the goal. */
    readonly input: unknown
    /** The schema of the output the step returns; the agent's final answer is parsed by it. */
    readonly output: S
    /** The most model turns the agent takes (a tool call or the final answer is one turn). Default 6, at most 12. */
    readonly maxTurns?: number | undefined
    /** A short kebab tag the calls are metered under; `agent` when absent. */
    readonly purpose?: string | undefined
    /** Pictures the agent should look at; none when absent. */
    readonly images?: ReadonlyArray<string> | undefined
    /**
     * How hard a reasoning model should think on the turns of this agent, when the node's author knows better than the host's default: `off`
     * for a call that only fills a form, `medium` or `high` for one that weighs evidence (money, a disputed fact). Absent: the
     * host's default for node calls. It bounds what the model spends on thinking nobody reads, never what the node may do.
     */
    readonly reasoning?: "off" | "low" | "medium" | "high" | undefined
}

/** The agent of a step: the model with the step's own tools in its hands. */
export interface NodeAgent {
    /**
     * Runs the agent on the goal. Each turn it calls one of the node's declared effects or tools, or gives the step's output, or says
     * it is confused. Every call goes through the same `context.effect` / `context.tools.call` a node's own code would use, so the
     * allow-list, the payload schema, the once-per-key ledger and the executor's guards all hold; the key of a call is the
     * runner's (the step and the place of the call), never the agent's. A result, and a refusal, come back to the agent as a fact.
     * The output is refused until every effect the node `requires` succeeded and until it fits the schema. An agent that runs out of
     * turns answers `confused`, as one that says so does: `if (d.kind === "confused") return context.confused(d.confusion)`.
     */
    readonly run: <S extends z.ZodType>(request: NodeAgentRequest<S>) => Promise<NodeModelDecision<z.output<S>>>
}

/** How one effect call is told apart from a repeat. */
export interface EffectOptions {
    /**
     * A business key that makes the effect once per workspace across runs (`payment-request:<orderId>`): a repeat of the key does
     * nothing and answers the subject of the first. Without it the effect is once per run step.
     */
    readonly dedupeKey?: string
}

/** The NIVO MCP tools as a node reaches them: only the ones it declared, parsed both ways. */
export interface NodeTools {
    /** Calls a declared tool; the answer is parsed by the tool's result schema. */
    readonly call: <R = unknown>(name: Namespaced, args: Readonly<Record<string, unknown>>) => Promise<R>
}

/**
 * What a node's `run` receives.
 * @deprecated The old node frame: a template node receives `NodeContext` of `@nivo-lite/agent-sdk/template` (`defineTemplateNode`).
 */
export interface NodeContext<P extends z.ZodType = z.ZodType> {
    /** Which turn, workspace, agent and subject this run belongs to. */
    readonly turn: TurnRef
    /** The settings the graph spec gave this node, parsed by its `params` schema. */
    readonly params: z.output<P>
    /** The port through which the node reads and writes records. */
    readonly data: NodeData
    /** Runs an effect now and answers the subject it touched. An undeclared kind or a payload its schema refuses throws. */
    readonly effect: (kind: Namespaced, payload: EffectPayload, options?: EffectOptions) => Promise<SubjectRef>
    /** The metered model port for text and structured answers. */
    readonly model: NodeModel
    /** The agent of the step: the model calling the step's declared effects and tools itself. */
    readonly agent: NodeAgent
    /** The port that calls the MCP tools the node declared. */
    readonly tools: NodeTools
    /** The clock of the run; nodes read time here so tests can fix it. */
    readonly now: () => Date
    /**
     * Ends the step in a business failure (`return context.fail({...})`): the run records it typed and takes the node's `failed` route.
     * Never for a technical failure, which the node lets throw for the engine to retry.
     */
    readonly fail: (failure: StepFailure) => never
    /**
     * Ends the step because the AI of the node cannot decide (`return context.confused(decision.confusion)`). The engine takes it as a
     * step that could not complete: its AI core decides what happens next, and when nothing can, the team is told and the workflow
     * waits for the founder's answer, then this step runs again. No graph draws a branch for it.
     */
    readonly confused: (confusion: NodeConfusion) => never
}

/** A stored rows fixture by data kind. */
export type NodeStore = Readonly<Record<string, ReadonlyArray<Readonly<Record<string, unknown>>>>>

/** An effect an example expects, by kind alone or with the payload it must carry. */
export type NodeExampleEffect = Namespaced | { readonly kind: Namespaced; readonly payload: EffectPayload }

/**
 * One worked example of a node, which conformance runs.
 * @deprecated The old example shape: a template node's is `NodeExample` of `@nivo-lite/agent-sdk/template`.
 */
export interface NodeExample<I extends z.ZodType, O extends z.ZodType, P extends z.ZodType> {
    /** A short label shown when the example fails. */
    readonly name: string
    /** The settings the node runs with in this example. */
    readonly params: z.input<P>
    /** The input handed to the node in this example. */
    readonly input: z.input<I>
    /** The output the node must produce for the input; not compared when the example ends in a business `failure`. */
    readonly output: z.output<O>
    /** The code of the business failure (`NodeBusinessFailure`) the node must end in, after the effects it lists; absent when it succeeds. */
    readonly failure?: string | undefined
    /** The effects the node must run, in order, and no others. */
    readonly effects: ReadonlyArray<NodeExampleEffect>
    /** The rows the data port holds during the example; empty when absent. */
    readonly store?: NodeStore
    /** The model's answers, in call order: a text for `text`, a value for `json`. */
    readonly model?: ReadonlyArray<unknown>
    /** The tools' results, in call order. */
    readonly tools?: ReadonlyArray<unknown>
    /**
     * What each effect answers, by effect id, in call order: `{ "nivo.tool.order.confirm": [{ kind: "refused", id: "needs_owner_note", facts }] }`
     * scripts a refusal (or any subject with its facts) for that call. A call past the list, or an effect not named, answers the
     * made-up subject `{ kind: <effect id>, id: "<effect id>-<n>" }`.
     */
    readonly answers?: Readonly<Record<string, ReadonlyArray<SubjectRef>>>
    /** The run's grant; the node's own tools when absent. */
    readonly grant?: NodeGrant
}

/**
 * What `defineNode` takes.
 * @deprecated Kept while the nodes are converted: a package node is `defineTemplateNode` of `@nivo-lite/agent-sdk/template`.
 */
export interface NodeConfig<I extends z.ZodType, O extends z.ZodType, P extends z.ZodType> {
    /** The namespaced id a graph spec uses to place this node. */
    readonly id: Namespaced
    /** Which step of the graph the node can fill: trigger, condition, execute or output. */
    readonly role: NodeRole
    /** The words the editor shows for the node. */
    readonly title: SpecText
    /** The settings a graph spec gives the node; `z.object({})` when it takes none. */
    readonly params: P
    /** The schema the input is parsed with before the node runs. */
    readonly input: I
    /** A condition's output holds `branch`, which the graph routes on. */
    readonly output: O
    /**
     * The typed `fields` of the node's business failure (`NodeBusinessFailure`), which `steps.<key>.error.fields.*` refs are checked
     * against at save; absent when the node never fails on business grounds.
     */
    readonly failure?: z.ZodType | undefined
    /** Lead facts its output proves, by fact then the dotted output path (`{ address: "deliveryAddress" }`), written into lead memory. */
    readonly facts?: Readonly<Partial<Record<LeadFact, string>>> | undefined
    /** Output members holding a secret or personal data, by dotted path: masked when memory is read for display. */
    readonly sensitive?: Readonly<Record<string, Sensitivity>> | undefined
    /** The effect kinds it may run. */
    readonly effects: ReadonlyArray<Namespaced>
    /** The NIVO MCP tools it may call, by capability name; none when absent. */
    readonly tools?: ReadonlyArray<Namespaced>
    /**
     * False for a side node that only informs someone (an owner notice, a report): when it fails after its own tries, the run records it as
     * failed, tells a person and goes on to the node that follows, so it never blocks the customer's path. A graph node may say it again.
     * Absent or true, a failure stops the run as usual.
     */
    readonly blocking?: boolean
    /**
     * The calls the step must have made for its agent's output to stand (`context.agent.run`): each a declared effect or tool. The
     * agent's final answer is refused, and told why, until a call of each succeeded in this step.
     */
    readonly requires?: ReadonlyArray<Namespaced> | undefined
    /** The work of the node. A method, so a list of nodes of different shapes holds together. */
    run(input: z.output<I>, context: NodeContext<P>): Promise<z.input<O>>
    /** At least one worked example, which conformance runs against the node. */
    readonly examples: readonly [NodeExample<I, O, P>, ...Array<NodeExample<I, O, P>>]
}

/** A node as registered: the config plus the tag a registry sorts on. */
export interface NodeDefinition<
    I extends z.ZodType = z.ZodType,
    O extends z.ZodType = z.ZodType,
    P extends z.ZodType = z.ZodType,
> extends NodeConfig<I, O, P> {
    /** Tag that tells a registry this definition is a node. */
    readonly entry: "node"
}
