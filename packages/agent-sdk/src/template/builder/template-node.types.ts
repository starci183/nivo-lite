import type { z } from "../../schema/zod-entry"
import type { ModelChoice, Mode, NodeId } from "../../graph/graph-spec-v2.types"
import type { LeadFact, Sensitivity } from "../../node/memory.contracts"
import type { ProviderKey, ToolId, ToolNames } from "../../names"
import type { JsonObject, JsonValue, SpecText } from "../../schema/schema.types"

/** The record a run serves, as ids: the lead or the conversation (`{ kind: "lead", id }`). */
export interface SubjectRef {
    /** The kind of the record (`lead`, `conversation`). */
    readonly kind: string
    /** Its id. */
    readonly id: string
}

/**
 * The iteration a loop body runs for: in an `over` loop the item (its key: the item key field, or the index as text; its index); in an
 * `until` loop the round (its key: the round number from 1 as text; its index: the round less one).
 */
export interface ItemRef {
    /** The item's key: the value of the loop's `itemKey` member, or the index written as text. */
    readonly key: string
    /** Its position in the list, from 0. */
    readonly index: number
}

/** The account a tool call went through: null for NIVO's own tools. */
export interface ToolVia {
    /** The provider that answered; null for a tool NIVO answers itself. */
    readonly provider: ProviderKey | null
    /** The id of the account connection that answered; null for NIVO's own tools. */
    readonly connectionId: string | null
}

/**
 * Beside the body of an outside system's answer (the CRM): its HTTP status, whether the answer was cut (`truncated`) and how many list
 * entries were dropped (`omitted`), and the facts it came with (`facts`: the notice that it is data, never instructions; `dryRun` /
 * `dryRunForced` of a write that has the switch).
 */
export interface OutsideAnswerMeta {
    /** The provider's status for the call. */
    readonly status: number
    /** Whether the answer was cut at the size the engine passes on. */
    readonly truncated: boolean
    /** How many parts of the answer the cut left out. */
    readonly omitted: number
    /** Facts of the call the provider supplied beyond its answer. */
    readonly facts: JsonObject
}

/**
 * Beside the facts of a NIVO effect (an order, a lead, a payment, a team or customer line, a care task, a report): the record it wrote
 * or acted on (`subject`: its kind and id). The facts themselves are the answer's `value`, the business members a node reads.
 */
export interface EffectAnswerMeta {
    /** The thing the effect was done about. */
    readonly subject: SubjectRef
}

/** What a `ToolAnswer` says beside its value: an outside system's envelope, or the record a NIVO effect wrote. */
export type ToolAnswerMeta = OutsideAnswerMeta | EffectAnswerMeta

/**
 * What `ctx.tools.call` answers. A business refusal (`ok: false`) is a FACT the node reads; an engine failure never returns: it freezes
 * the node and is reported to /chat, so a node never branches on errors.
 */
export type ToolAnswer<A, R extends string = string> =
    | {
          readonly ok: true
          /** What the tool answered: for an outside system's operation (the CRM), the BODY that system answered. */
          readonly value: A
          readonly via: ToolVia
          /** What the answer says beside its value, never inside it (`ToolAnswerMeta`); absent for NIVO's own reads. */
          readonly meta?: ToolAnswerMeta
      }
    | {
          readonly ok: false
          readonly refusal: R
          readonly facts: JsonObject
          /** Never true here: a declined approval is its own member (`ToolDeclined`), so `answer.declined` tells the two apart. */
          readonly declined?: false | undefined
      }

/**
 * The code the engine answers a call with when a person declined the approval it asked for (an `ask` mode). It travels on the wire as
 * the refusal code (`{ ok: false, refusal: "declined" }`); a node reads it as `ToolDeclined`, never as one of the tool's refusals.
 */
export type DeclinedRefusal = "declined"

/**
 * What a call of a tool that can ASK answers when a person declined its approval (owner chot 2026-11-13, nivo-frame `rights` rule 11c):
 * a business outcome, never a failure. It carries no `refusal` in its type, so a node that reads `answer.refusal` after `!answer.ok`
 * does not compile until it has handled `answer.declined` (its business `declined` branch): TypeScript forces the branch. At run it
 * still carries `refusal: "declined"` for the readers that take any refusal (the agent loop).
 */
export interface ToolDeclined {
    /** Always false: a declined call did not run. */
    readonly ok: false
    /** Always true: the person who was asked said no. */
    readonly declined: true
    /** What the engine records of the refusal. */
    readonly facts: JsonObject
}

/** A declined answer as it travels (the engine's door, a scripted example): `ToolDeclined` still carrying its wire code. */
export interface DeclinedAnswer extends ToolDeclined {
    /** Why the call was declined. */
    readonly refusal: DeclinedRefusal
}

/** `ToolDeclined` for a tool that can ask (its signature is `Asking`: it mutates), nothing for a read (a read never asks). */
export type DeclinedOf<K extends ToolId> = ToolNames[K] extends { readonly asks: true } ? ToolDeclined : never

/**
 * The business refusals of tool `K`: its own (`ToolNames[K]["refusals"]`: a literal union for a tool whose engine spec holds a closed
 * set, so `answer.refusal === "<code>"` is checked by tsc; `string` for an open set). A declined approval is not one of them: it is the
 * answer's own member (`ToolDeclined`).
 */
export type ToolRefusal<K extends ToolId> = ToolNames[K]["refusals"]

/**
 * What `ctx.tools.call` answers for tool `K`: its answer type, its refusal typed from its signature, and, for a tool that can ask (a
 * write), the declined member (`ToolDeclined`) the node must handle.
 */
export type ToolAnswerOf<K extends ToolId> = ToolAnswer<ToolNames[K]["answer"], ToolRefusal<K>> | DeclinedOf<K>

/**
 * `T` when every value of it is JSON, member by member: text, numbers, booleans, null, lists and objects of them (an optional or
 * `undefined` member is left out when written). A function, a symbol key, a bigint, a `Date` or `unknown` maps to `never`, so
 * `T` fits `Jsonable<T>` only for a JSON shape: what `asJson` checks, for an `interface` that `JsonValue` will not take.
 */
export type Jsonable<T> = T extends string | number | boolean | null
    ? T
    : T extends (...args: never) => unknown
      ? never
      : T extends ReadonlyArray<infer U>
        ? ReadonlyArray<Jsonable<U>>
        : T extends object
          ? { readonly [K in keyof T]: K extends string ? JsonableMember<T[K]> : never }
          : never

/** A member of a JSON object: JSON, or absent. */
type JsonableMember<T> = T extends undefined ? undefined : Jsonable<T>

/** Why a node ends without its output: the AI is confused (with the question a person's answer would settle), or it cannot. */
export type FailReason =
    { readonly kind: "confused"; readonly question: string | null } | { readonly kind: "cannot"; readonly why: string }

/** The tools a node reaches: only the ones it declares, by typed id. */
export interface TemplateNodeTools {
    /**
     * Calls a declared tool through the engine's ToolRunner (ledger, accounts, rights, approval, fallback). The refusal is typed
     * (`ToolRefusal<K>`): a comparison with a code the tool never answers does not compile.
     */
    call<K extends ToolId>(id: K, args: ToolNames[K]["args"]): Promise<ToolAnswerOf<K>>
}

/** What a node asks its agent (the model with the node's tools in hand). */
export interface TemplateAgentRequest<S extends z.ZodType> {
    /** What the step must achieve, in the node author's words. */
    readonly goal: string
    /**
     * What it works on, as data: a `JsonValue`. A value typed by a `type` alias of JSON members fits; one typed by an `interface` does not
     * (an interface has no index signature, so tsc cannot prove it JSON): declare such shapes with `type`, or pass `asJson(value)` (checked by `Jsonable`).
     */
    readonly input: JsonValue
    /** The schema of the answer. */
    readonly output: S
    /** The most model turns; a run with no tool is `maxTurns: 1`. */
    readonly maxTurns?: number | undefined
    /** Pictures to look at, as short-lived addresses. */
    readonly images?: ReadonlyArray<string> | undefined
    /** The tools the agent may call in this run: a subset of the node's `tools` (ruling B6); absent: all of them. */
    readonly tools?: ReadonlyArray<ToolId> | undefined
}

/** The agent of a node. A confused model never returns here: `run` itself ends the node (`FailReason` `confused`). */
export interface TemplateNodeAgent {
    /** Runs one model turn for the request and returns its answer, parsed by the request's output schema. */
    run<S extends z.ZodType>(request: TemplateAgentRequest<S>): Promise<z.output<S>>
}

/** The run a node works in. */
export interface TemplateRun {
    /** The run's id. */
    readonly id: string
    /** The run step's instant (ISO 8601), fixed across re-runs: what a node reads instead of the clock. */
    readonly at: string
    /**
     * The run's day (`YYYY-MM-DD`) in the workspace's time zone: the calendar day of `at` where the shop is, fixed with it. What a node
     * keys a daily round or a "today" read by, never the UTC date of `at`.
     */
    readonly day: string
    /** Inside a loop body: the item (`over`) or the round (`until`); null elsewhere. */
    readonly item: ItemRef | null
    /**
     * The run's QUEUE as this step took it: the events with the run's correlation key that arrived while the run was in flight (busy in a
     * step, parked at a wait, held at a stop) instead of starting a run of their own, and that no earlier step of the run took; oldest
     * first, each the trigger scope as its event supplied it (the generic members of its verb). Empty when none. The snapshot is recorded
     * with the step: a re-run of the step reads the same events, and none is delivered twice or lost.
     */
    readonly queue: ReadonlyArray<JsonObject>
    /**
     * How many events of the run's subject WAIT for it, as stored rows, at the start of this step attempt (fixed for the attempt: a re-run of the
     * same attempt reads the same number). They are offered to the run's next `wait` first, else the next run takes them; a step may read
     * it to keep its answer short or to end the run. 0 when none.
     */
    readonly waiting: number
    /**
     * The names of THIS step's routes the engine cannot follow in this installation: a hand-off on the route's road (`callWorkflow`) names
     * a workflow no agent installed in the workspace holds. A routing node that lets its agent pick the route offers only the others, and
     * serves an intent with no installed target itself; it never routes into a missing target. Absent or empty: every route can be taken.
     */
    readonly unreachable?: ReadonlyArray<string> | undefined
}

/**
 * The workspace's own facts a node reads (`ctx.workspace`), from its stored settings: its IANA time zone (the zone its days are counted
 * in, as `run.day`), the name it shows (its brand name when one is saved), and the address of its logo when one is saved. There is no
 * workspace language setting: a node reads the run's language through what its agent writes in, never a field here.
 */
export interface WorkspaceFacts {
    /** The workspace's IANA time zone. */
    readonly timeZone: string
    /** The brand name when the workspace saved one. */
    readonly name: string
    /** The logo when the workspace saved one. */
    readonly logo?: string | undefined
}

/** What a template node's `run` receives. */
export interface NodeContext<P extends z.ZodType = z.ZodType> {
    /** The node's settings, parsed by its `params` schema. */
    readonly params: z.output<P>
    /** The run. */
    readonly run: TemplateRun
    /** The lead or conversation the run serves, as ids. */
    readonly subject: SubjectRef | null
    /** The workspace's own facts (time zone, name, logo), read by the engine from its stored settings. */
    readonly workspace: WorkspaceFacts
    /** The declared tools. */
    readonly tools: TemplateNodeTools
    /** The agent. */
    readonly agent: TemplateNodeAgent
    /** The agent's hard limits (read-only). Soft policy is the truth graph, read by tools. */
    readonly policy: Readonly<Record<string, number | string | boolean>>
    /** Ends the node without its output. */
    fail(reason: FailReason, facts?: JsonObject): never
}

/** The output member of `O` a node routes by: a member of its output object (any string where the schema says nothing). */
export type OutputMember<O extends z.ZodType> = unknown extends z.output<O> ? string : keyof z.output<O> & string

/** How a routing node names its routes: the output member that holds the route, and the route names, in the order the editor lists them. */
export interface TemplateRoutes<O extends z.ZodType, R extends string> {
    /** The output member whose value names the route. */
    readonly by: OutputMember<O>
    /** The route names the node may take, at least one. */
    readonly names: readonly [R, ...Array<R>]
}

/** One scripted answer of `ctx.tools.call`: the id the call must name, the args it must carry (when given), and what it answers. */
export type ScriptedToolCall = {
    readonly [K in ToolId]: {
        readonly id: K
        readonly args?: ToolNames[K]["args"] | undefined
        /*
         * The refusal is `string` here (any code): the next/** fixtures build their answers with helpers that answer
         * `ToolAnswer<A>` (refusal `string`), so typing it `ToolAnswerOf<K>` waits until those helpers answer `ToolAnswer<A, never>` for
         * an ok answer (as `toolOk` does) and a literal code for a refusal (as `toolRefused` does). A declined approval is scripted as
         * the engine's code on the wire (`toolRefused("declined")`): the example runner reads it as `ToolDeclined`, as the engine's is.
         */
        readonly answer: ToolAnswer<ToolNames[K]["answer"]>
    }
}[ToolId]

/**
 * One scripted turn of `ctx.agent.run`, in call order: the answer it gives (parsed by the request's `output`), with the tool calls the
 * model made during it (checked against the node's `tools`, counted for `requires`); or the failure it ends the node with, with the calls
 * the model made before it gave up (checked and counted the same way).
 */
export type ScriptedAgentTurn =
    | { readonly answer: JsonValue; readonly calls?: ReadonlyArray<ScriptedToolCall> | undefined }
    | { readonly fail: FailReason; readonly calls?: ReadonlyArray<ScriptedToolCall> | undefined }

/** What an example expects at the end: the output, or the failure. */
export type ExampleEnd<O extends z.ZodType> =
    | { readonly output: z.output<O>; readonly failure?: undefined }
    | { readonly failure: FailReason; readonly output?: undefined }

/** One worked example of a template node, which `checkTemplateNode` runs with no engine. */
export type NodeExample<I extends z.ZodType, O extends z.ZodType, P extends z.ZodType> = ExampleEnd<O> & {
    /** A short label shown when the example fails. */
    readonly name: string
    /** The settings. */
    readonly params: z.input<P>
    /** The input. */
    readonly input: z.input<I>
    /** The answers of `ctx.tools.call`, in call order; a call past the list, an id other than the next one, or an undeclared id fails. */
    readonly tools?: ReadonlyArray<ScriptedToolCall> | undefined
    /** The turns of `ctx.agent.run`, in call order. */
    readonly agent?: ReadonlyArray<ScriptedAgentTurn> | undefined
    /** The run's instant; `EXAMPLE_RUN_AT` when absent. */
    readonly at?: string | undefined
    /** The run's day in the workspace's time zone (`YYYY-MM-DD`); absent: the date `at` is written with (its first ten characters). */
    readonly day?: string | undefined
    /** The item or the round, for a node that runs inside a loop body; null when absent. */
    readonly item?: ItemRef | undefined
    /** The run's queue as the step took it (`run.queue`); none when absent. */
    readonly queue?: ReadonlyArray<JsonObject> | undefined
    /** The events waiting for the run (`run.waiting`); 0 when absent. */
    readonly waiting?: number | undefined
    /** The step's routes the engine cannot follow in the installation (`run.unreachable`); none when absent. */
    readonly unreachable?: ReadonlyArray<string> | undefined
    /** The subject; null when absent. */
    readonly subject?: SubjectRef | undefined
    /** The workspace's facts (`ctx.workspace`); `EXAMPLE_WORKSPACE` when absent. */
    readonly workspace?: WorkspaceFacts | undefined
    /** The agent's hard limits; empty when absent. */
    readonly policy?: Readonly<Record<string, number | string | boolean>> | undefined
}

/** A node's description in both languages: what it does, in plain words. */
export interface NodeDescription {
    /** The description in Vietnamese. */
    readonly vi: string
    /** The description in English. */
    readonly en: string
}

/** What `defineTemplateNode` takes. */
export interface TemplateNodeConfig<
    I extends z.ZodType,
    O extends z.ZodType,
    P extends z.ZodType,
    R extends string = never,
> {
    /** `<module>.<feature>`; ONE node = ONE feature (a failed node re-runs whole). */
    readonly id: NodeId
    /** The words the editor shows. */
    readonly title: SpecText
    /**
     * What the node does, in plain words, in both languages (`NODE_DESCRIPTION_MISSING` when absent or one language is blank): the
     * engine's approval card shows it and briefs the AI with it (nivo-frame `rights` rule 11e).
     */
    readonly description: NodeDescription
    /** The tools the node may call, and nothing else. */
    readonly tools: ReadonlyArray<ToolId>
    /**
     * How the node's calls run (`nivo-frame.rights`): `auto` runs them; `ask` interrupts for a person's approval on a card in /chat, then
     * runs (a decline answers `declined`). REQUIRED: there is no engine default, no per-tool mode, no money class; a graph step may set
     * either mode for its step.
     */
    readonly mode: Mode
    /**
     * The providers the node may act through, in PRIORITY order (alternatives: the ToolRunner tries them by data, then by this order); `[]`
     * for a node of NIVO's own tools only (NIVO itself is never listed). No connection: bound at install.
     */
    readonly accounts: ReadonlyArray<ProviderKey>
    /** The schema the input is parsed with (an object: a graph binds it by member). */
    readonly input: I
    /** The schema of the output. */
    readonly output: O
    /** The schema of the settings (an object); `z.object({})` when absent. */
    readonly params?: P | undefined
    /** The model of the node's AI calls; absent for a node that never calls `ctx.agent.run` (one that does fails `NODE_MODEL_MISSING`, ruling B7). */
    readonly model?: ModelChoice | undefined
    /** Default true. False: a side node, skipped (and named on the agent page) when none of its providers is connected. */
    readonly blocking?: boolean | undefined
    /** The calls the step must have made (ok) for its output to stand. */
    readonly requires?: ReadonlyArray<ToolId> | undefined
    /** The output member that names the route, and the route names. */
    readonly routes?: TemplateRoutes<O, R> | undefined
    /** Lead facts its output proves, by fact then the dotted output path. */
    readonly facts?: Readonly<Partial<Record<LeadFact, string>>> | undefined
    /** Output members holding a secret or personal data, by dotted path. */
    readonly sensitive?: Readonly<Record<string, Sensitivity>> | undefined
    /** The work of the node. A method, so a list of nodes of different shapes holds together. */
    run(input: z.output<I>, ctx: NodeContext<P>): Promise<z.input<O>>
    /** At least one worked example. */
    readonly examples: readonly [NodeExample<I, O, P>, ...Array<NodeExample<I, O, P>>]
}

/** The routes of a defined node: the member it routes by, and the route names. */
export interface NodeRoutes<R extends string> {
    /** The output member whose value names the route. */
    readonly by: string
    /** The route names the node may take, at least one. */
    readonly names: readonly [R, ...Array<R>]
}

/** A template node as defined: its config (its routes with `by` as text, so nodes of different outputs hold in one list), tagged. */
export interface TemplateNode<
    I extends z.ZodType = z.ZodType,
    O extends z.ZodType = z.ZodType,
    P extends z.ZodType = z.ZodType,
    R extends string = string,
> extends Omit<TemplateNodeConfig<I, O, P, R>, "routes"> {
    /** The output member that routes the node and the route names it takes; absent: the node does not route. */
    readonly routes?: NodeRoutes<R> | undefined
    /** Tag that tells a registry this definition is a template node. */
    readonly entry: "template-node"
}

/** The route names of a node. */
export type RouteOf<N> = N extends TemplateNode<z.ZodType, z.ZodType, z.ZodType, infer R> ? R : never

/** The input of a node, as its schema takes it. */
export type InputOf<N> = N extends TemplateNode<infer I, z.ZodType, z.ZodType, string> ? z.input<I> : never

/** The settings of a node, as its schema takes them. */
export type SettingsOf<N> = N extends TemplateNode<z.ZodType, z.ZodType, infer P, string> ? z.input<P> : never

/**
 * Any template node, as a list of nodes of different shapes holds it. Declared here, with the types only, so a crypto-free entry (the
 * installation, the node runner, the client build) can name it without loading the example runner.
 */
export type AnyTemplateNode = TemplateNode<z.ZodType, z.ZodType, z.ZodType, string>
