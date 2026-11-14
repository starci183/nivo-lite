import type { z } from "../../schema/zod-entry"
import type { CompareOp, GraphCatalogue, GraphSpecV2, LoopEvery, LoopExitLabels, Mode, PresenceOp, UnsuccessfulThen } from "../../graph/graph-spec-v2.types"
import type { TriggerCondition } from "../../graph/workflow-contract"
import type { LeadFact } from "../../node/memory.contracts"
import type { ProviderKey, TriggerVerb } from "../../names"
import type { JsonObject, JsonValue, SpecText } from "../../schema/schema.types"
import type { InputOf, RouteOf, SettingsOf, AnyTemplateNode } from "./template-node.types"
import type { TemplateProblem } from "./template-problems"

/** The phantom of a ref's type: never present at run time, so a ref is plain `{ $ref, default? }` JSON. */
export declare const REF_TYPE: unique symbol

/**
 * A ref to a value of type `T`, stored as the `ParamRef` form. `ref()` without a type argument is `Ref<never>`: it fits any binding at
 * compile time and is typed at SAVE against the source's schema (`GRAPH_REF_TYPE`); with one, `tsc` checks it at the binding too.
 */
export interface Ref<T = never> {
    /** The path the ref reads. */
    readonly $ref: string
    /** What the ref reads when its source holds nothing; absent: null. */
    readonly default?: JsonValue | undefined
    /** `previous`: the referenced `until`-body step's output of the round before (see `RefOptions.round`). */
    readonly round?: "previous" | undefined
    readonly [REF_TYPE]?: T
}

/** Where a ref may read: what woke the run, a step's output, a fact of the lead's memory. */
export type RefPath = `trigger.${string}` | `steps.${string}.output${string}` | `lead.${LeadFact}`

/** A value bound to a member: fixed, or a ref. */
export type Bound<T> = T | Ref<T>

/** A ref, or a fixed JSON value. */
export type RefOrValue = Ref<JsonValue> | JsonValue

/**
 * One comparison of an expression: `eq` / `ne` by canonical JSON, the order operators on two numbers or two ISO instants, `contains` on two
 * texts (`caseFold` only there, only when declared).
 */
export interface CompareCondition {
    /** The comparison. */
    readonly op: CompareOp
    /** The value read on the left. */
    readonly ref: Ref<JsonValue>
    /** What it is compared with: a fixed value or a ref. */
    readonly value: RefOrValue
    /** Fold both texts to one case before `contains`; only there. */
    readonly caseFold?: true | undefined
    /** Absent: a comparison is a leaf, never a group. */
    readonly and?: never
    /** Absent: a comparison is a leaf, never a group. */
    readonly or?: never
    /** Absent: a comparison is a leaf, never a group. */
    readonly not?: never
}

/** One presence test of an expression: not null, not empty text, not an empty list (`present`), or the opposite. */
export interface PresenceCondition {
    /** `present` or `absent`. */
    readonly op: PresenceOp
    /** The value tested. */
    readonly ref: Ref<JsonValue>
    /** Absent: a presence test compares nothing. */
    readonly value?: never
    /** Absent: a presence test is a leaf, never a group. */
    readonly and?: never
    /** Absent: a presence test is a leaf, never a group. */
    readonly or?: never
    /** Absent: a presence test is a leaf, never a group. */
    readonly not?: never
}

/** A leaf of an expression. */
export type LeafCondition = CompareCondition | PresenceCondition

/** The members a group of an expression never holds beside its own. */
interface NotALeaf {
    readonly op?: never
    readonly ref?: never
    readonly value?: never
}

/** Every part holds. */
export interface AndExpr<E> extends NotALeaf {
    /** The parts that must all hold, at least one. */
    readonly and: readonly [E, ...Array<E>]
    /** Absent: a group is named by exactly one of `and` / `or` / `not`. */
    readonly or?: never
    /** Absent: a group is named by exactly one of `and` / `or` / `not`. */
    readonly not?: never
}

/** At least one part holds. */
export interface OrExpr<E> extends NotALeaf {
    /** The parts of which at least one must hold, at least one part. */
    readonly or: readonly [E, ...Array<E>]
    /** Absent: a group is named by exactly one of `and` / `or` / `not`. */
    readonly and?: never
    /** Absent: a group is named by exactly one of `and` / `or` / `not`. */
    readonly not?: never
}

/** The part does not hold. */
export interface NotExpr<E> extends NotALeaf {
    /** The part that must not hold. */
    readonly not: E
    /** Absent: a group is named by exactly one of `and` / `or` / `not`. */
    readonly and?: never
    /** Absent: a group is named by exactly one of `and` / `or` / `not`. */
    readonly or?: never
}

/** A group of an expression over parts of type `E`. */
export type ExprGroup<E> = AndExpr<E> | OrExpr<E> | NotExpr<E>

/** An expression of depth at most 2. */
export type Expr2 = LeafCondition | ExprGroup<LeafCondition>

/** An expression of depth at most 3: what `and` / `or` / `not` take as parts. */
export type Expr3 = LeafCondition | ExprGroup<Expr2>

/**
 * The engine's expression language (`loop.until`, `ifNode.when`): a leaf, or `and` / `or` / `not` over expressions, at most
 * `EXPR_DEPTH_MAX` (4) deep, a leaf being depth 1: deeper does not compile. The leaves (at most 16, `EXPR_TOO_LARGE`) are counted at save.
 * The object-literal form is as legal as the builders (`present`, `equals`, `and`, ...).
 */
export type Expr = LeafCondition | ExprGroup<Expr3>

/** An expression with no bound on its depth: what the compile and the save walk (the bounds are judged as `EXPR_TOO_DEEP`). */
export type UnboundedExpr =
    | LeafCondition
    | AndExpr<UnboundedExpr>
    | OrExpr<UnboundedExpr>
    | NotExpr<UnboundedExpr>

/** The value an order operator compares against: a ref, a number or an ISO 8601 instant. */
export type OrderValue = Ref<JsonValue> | number | string

/** The input bindings of a node's step, by member. */
export type Bindings<N> = { readonly [K in keyof InputOf<N>]?: Bound<InputOf<N>[K]> }

/** The settings of a node's step, by member. */
export type ParamsOf<N> = { readonly [K in keyof SettingsOf<N>]?: Bound<SettingsOf<N>[K]> }

/** How a template node is placed: its bindings, its mode for this step, a narrowing of its providers, and where the run goes after it. */
export interface NodeWiring<N> {
    /** The node's input, by member: a fixed value or a ref. */
    readonly input?: Bindings<N> | undefined
    /** The node's settings, by member: a fixed value or a ref. */
    readonly params?: ParamsOf<N> | undefined
    /**
     * The mode of this step: the WORKFLOW decides (`nivo-frame.rights`), so either mode is legal whatever the node declares (there is no
     * "wider" for modes); absent: the node's.
     */
    readonly mode?: Mode | undefined
    /** A NARROWING of the node's providers (a subset, a reorder); absent: the node's list. */
    readonly accounts?: ReadonlyArray<ProviderKey> | undefined
    /** The step after it, for a node that does not route. */
    readonly next?: string | undefined
    /** For a routing node: the step of each route name, all of them. */
    readonly routes?: Readonly<Record<RouteOf<N>, string>> | undefined
    /**
     * What the ENGINE does when this step ends unsuccessfully (R68: a customer send refused other than `route_held`, an approval declined,
     * the node's `cannot`): it tells the team itself, with `facts`, then follows `then`. Absent: today's road (nothing reported for it).
     */
    readonly unsuccessful?: StepUnsuccessful | undefined
}

/** One fact the engine's team notice carries: a label in both languages and its value (a ref, or a fixed value). */
export interface NoticeFact {
    /** The label a person reads (`{ vi, en }`). */
    readonly label: SpecText
    /** The value: a ref read when the step ended (a null value is left out), or a fixed one. */
    readonly value: RefOrValue
}

/**
 * A step's unsuccessful ending (R68). The engine reports it to the team in /chat (the workflow, the step, the typed reason and `facts`)
 * and the run goes on (`continue`: the step's own `next` or route) or ends (`end`: at the outcome step `outcome`). Graphs draw no notice
 * node and no "was it refused" `ifNode` for these endings.
 */
export interface StepUnsuccessful {
    /** Absent: `continue` for a step inside a loop body or a side step (`blocking: false`), `end` for any other step. */
    readonly then?: UnsuccessfulThen | undefined
    /** With `end` (written or by default): the key of the outcome step, outside every loop, the run ends at. */
    readonly outcome?: string | undefined
    /** What the notice says beside the reason (an order code, an amount), at most 6. */
    readonly facts?: ReadonlyArray<NoticeFact> | undefined
}

/** An `until` loop's unsuccessful ending (R68): when it runs out of rounds the engine tells the team, then the run takes `exhausted`. */
export interface LoopUnsuccessful {
    /** What the notice says beside the rounds, at most 6. */
    readonly facts?: ReadonlyArray<NoticeFact> | undefined
}

/** A template node placed in a graph. */
export interface NodeGraphStep {
    /** Tags the step as a placed template node. */
    readonly kind: "node"
    /** The template node placed. */
    readonly node: AnyTemplateNode
    /** The node's input bindings, by member. */
    readonly input: Readonly<Record<string, RefOrValue>>
    /** The node's settings bindings, by member. */
    readonly params: Readonly<Record<string, RefOrValue>>
    /** The mode of this step; null: the node's own. */
    readonly mode: Mode | null
    /** The narrowing of the node's providers; null: the node's list. */
    readonly accounts: ReadonlyArray<ProviderKey> | null
    /** The step after it for a node that does not route; null: none. */
    readonly next: string | null
    /** The step of each route name for a routing node; null: the node does not route. */
    readonly routes: Readonly<Record<string, string>> | null
    /** The step's unsuccessful ending as declared; null or absent: none. */
    readonly unsuccessful?: StepUnsuccessful | null | undefined
}

/** An `until` that stops by MEANING: when the body's routing node `route` takes its route `stop`. */
export interface UntilRoute {
    /** The body's routing node whose route is watched. */
    readonly route: string
    /** The route name that ends the loop. */
    readonly stop: string
    /** Absent: a route stop is not an expression leaf. */
    readonly op?: never
    /** Absent: a route stop is not an expression group. */
    readonly and?: never
    /** Absent: a route stop is not an expression group. */
    readonly or?: never
    /** Absent: a route stop is not an expression group. */
    readonly not?: never
}

/** What an `until` loop stops on: an expression (by data) or a route of a body node (by meaning). */
export type UntilCondition = Expr | UntilRoute

/** The body of a loop over a list: a keyed sub-branch, its start, and the step whose output the loop gathers (null: none). */
export interface LoopOverBody {
    /** The first step of the body. */
    readonly start: string
    /** The body's steps by key. */
    readonly nodes: Readonly<Record<string, GraphStep>>
    /** The body step whose output the loop gathers per item; null: none. */
    readonly collect: string | null
}

/** The body of a loop until a condition: a keyed sub-branch and its start. */
export interface LoopUntilBody {
    /** The first step of the body. */
    readonly start: string
    /** The body's steps by key. */
    readonly nodes: Readonly<Record<string, GraphStep>>
}

/** A loop over a list, as the builder returns it. */
export interface LoopOverGraphStep {
    /** Tags the step as a loop. */
    readonly kind: "loop"
    /** Tags the loop as one over a list. */
    readonly mode: "over"
    /** The list the loop runs over. */
    readonly over: Ref<ReadonlyArray<JsonValue>>
    /** The field path of an item that identifies it, or `"."` (the item itself); null: its index. */
    readonly itemKey: string | null
    /** The most items it runs, 1 to 50 (`LOOP_OVER_CAP`); the rest are held. */
    readonly max: number
    /** How many items run at once, 1 to 5 (`LOOP_CONCURRENCY_CAP`). */
    readonly concurrency: number
    /** The steps run once per item. */
    readonly body: LoopOverBody
    /** The step after the loop; null: the run ends there. */
    readonly next: string | null
    /** The words the map shows on this step (SpecText, both languages); null or absent: the generic word. */
    readonly label?: SpecText | null | undefined
}

/** A loop until a condition, as the builder returns it. */
export interface LoopUntilGraphStep {
    /** Tags the step as a loop. */
    readonly kind: "loop"
    /** Tags the loop as one run until a condition holds. */
    readonly mode: "until"
    /** The condition that ends the loop, checked after each round. */
    readonly until: UntilCondition
    /** The most rounds, 1 to 10 (`LOOP_UNTIL_CAP`). */
    readonly max: number
    /** The wait between two rounds; null: none. */
    readonly every: LoopEvery | null
    /** The steps run in each round. */
    readonly body: LoopUntilBody
    /** The step after the loop when its condition held. */
    readonly next: string
    /** The step after the loop when it ran out of rounds. */
    readonly exhausted: string
    /** The team notice the engine posts when it runs out of rounds; null or absent: none. */
    readonly unsuccessful?: LoopUnsuccessful | null | undefined
    /** The words the map shows on this step (SpecText, both languages); null or absent: the generic word. */
    readonly label?: SpecText | null | undefined
    /** The words of its two ways out on the map; null or absent: the generic words. */
    readonly exits?: LoopExitLabels | null | undefined
}

/** A loop, as the builder returns it. */
export type LoopGraphStep = LoopOverGraphStep | LoopUntilGraphStep

/** A data condition. */
export interface IfGraphStep {
    /** Tags the step as a data condition. */
    readonly kind: "if"
    /** The condition tested. */
    readonly when: Expr
    /** The step when it holds (its `yes` route), or `endItem` / `endRound` in a loop body. */
    readonly yes: string
    /** The step when it does not hold (its `no` route), `endItem` in a body, or null: the ITEM (ROUND) ends in a body, the RUN outside. */
    readonly no: string | null
    /** The words the map shows on this step (SpecText, both languages); null or absent: the generic word. */
    readonly label?: SpecText | null | undefined
}

/** The version a hand-off calls. */
export type CallVersion = number | "latest"

/** An end hand-off. */
export interface CallWorkflowGraphStep {
    /** Tags the step as an end hand-off. */
    readonly kind: "call-workflow"
    /** The key of the agent whose workflow is called. */
    readonly agent: string
    /** The key of the workflow called. */
    readonly workflow: string
    /** The version called: a number, or `latest`. */
    readonly version: CallVersion
    /** What the called workflow is given, by input name. */
    readonly input: Readonly<Record<string, RefOrValue>>
    /** The step after the call; null: the run ends there. */
    readonly next: string | null
}

/** One call of a `callWorkflows`: made only when its list is present (not null, not empty). */
export interface ListedCall {
    /** The key of the agent whose workflow is called. */
    readonly agent: string
    /** The key of the workflow called. */
    readonly workflow: string
    /** The version called; absent: `latest`. */
    readonly version?: CallVersion | undefined
    /** Its list (the call is made only when the list is present: not null, not empty), or an expression over refs. */
    readonly when: Ref<ReadonlyArray<JsonValue>> | Expr
    /** What the called workflow is given, by input name. */
    readonly input: Readonly<Record<string, RefOrValue>>
}

/** Several end hand-offs, each passed its list once, a call skipped when its list is empty. */
export interface CallWorkflowsGraphStep {
    /** Tags the step as several end hand-offs. */
    readonly kind: "call-workflows"
    /** The calls, each made only when its list is present. */
    readonly calls: readonly [ListedCall, ...Array<ListedCall>]
    /** The step after the calls; null: the run ends there. */
    readonly next: string | null
}

/** A named business end. */
export interface OutcomeGraphStep {
    /** Tags the step as a business end. */
    readonly kind: "outcome"
    /** The name of the business end. */
    readonly name: string
    /** What the end reports, by member. */
    readonly output: Readonly<Record<string, RefOrValue>>
    /** The step after the end; null: the run ends there. */
    readonly next: string | null
    /** The words the map shows on this step (SpecText, both languages); null or absent: the generic word. */
    readonly label?: SpecText | null | undefined
}

/** One test a waited event must meet: its member equals (or, `contains`, holds) a value, a fixed one or a ref read when the wait begins. */
export interface WaitMatch {
    /** The member of the event that is tested. */
    readonly member: string
    /** `eq` for equality, `contains` for a text that holds the value. */
    readonly op: "eq" | "contains"
    /** What the member is tested against: a fixed value or a ref read when the wait begins. */
    readonly value: RefOrValue
    /** Fold both texts to one case before `contains`; only there. */
    readonly caseFold?: true | undefined
}

/** One trigger a wait listens for, as `waitFor` builds it: a graph trigger's verb and `where`, and the match against the run's data. */
export interface WaitTrigger {
    /** The trigger verb whose events are waited for. */
    readonly verb: TriggerVerb
    /** Conditions on the event's params that must all hold. */
    readonly where?: ReadonlyArray<TriggerCondition> | undefined
    /** Tests of the event's members against the run's data. */
    readonly match?: ReadonlyArray<WaitMatch> | undefined
}

/** How long a wait waits: `"<n>m"`, `"<n>h"`, `"<n>d"`, or one unit of `LoopEvery` (minutes 1–1440, hours 1–720, days 1–30). */
export type WaitTimeout = LoopEvery | `${number}${"m" | "h" | "d"}`

/** A wait, as the builder returns it: its triggers by key, its timeout and the step of each key and of `timeout`. */
export interface WaitGraphStep {
    /** Tags the step as a wait. */
    readonly kind: "wait"
    /** The triggers the wait listens for, by key. */
    readonly on: Readonly<Record<string, WaitTrigger>>
    /** How long the run stays parked. */
    readonly timeout: WaitTimeout
    /** The step of each trigger key and of `timeout`. */
    readonly next: Readonly<Record<string, string>>
    /** The words the map shows on this step (SpecText, both languages); null or absent: the generic word. */
    readonly label?: SpecText | null | undefined
}

/** A hand-back, as `handBack` returns it: the wait whose event is offered on, and the step after it. */
export interface HandBackGraphStep {
    /** Tags the step as a hand-back. */
    readonly kind: "hand-back"
    /** The key of the wait whose event this run hands back. */
    readonly wait: string
    /** The step after the hand-back (or `endRound` in a loop body); null: the round (in a body) or the run ends there. */
    readonly next: string | null
    /** The words the map shows on this step (SpecText, both languages); null or absent: the generic word. */
    readonly label?: SpecText | null | undefined
}

/** One step of a template graph, as the builders return it. */
export type GraphStep =
    | NodeGraphStep
    | LoopGraphStep
    | IfGraphStep
    | CallWorkflowGraphStep
    | CallWorkflowsGraphStep
    | OutcomeGraphStep
    | WaitGraphStep
    | HandBackGraphStep

/** One trigger at the head of a graph: one purpose (verb), listening on the accounts of the providers listed when providers carry it. */
export interface TemplateTrigger {
    /** The trigger verb that wakes the graph. */
    readonly verb: TriggerVerb
    /** The verb's own arguments. */
    readonly args?: JsonObject | undefined
    /** The providers whose accounts carry the event, each once (one source per stream at bind time); absent for an engine-road verb. */
    readonly accounts?: ReadonlyArray<ProviderKey> | undefined
    /** Conditions on the event's params that must all hold. */
    readonly where?: ReadonlyArray<TriggerCondition> | undefined
}

/** What `defineTemplateGraph` takes. */
export interface TemplateGraphConfig {
    /** `<module>.<workflow>`. */
    readonly key: string
    /** The graph's name in both languages. */
    readonly title: SpecText
    /** The graph's inputs (its contract): an object schema, each member a contract type, optional members not required. */
    readonly input: z.ZodType
    /** The triggers that wake the graph, at least one. */
    readonly triggers: readonly [TemplateTrigger, ...Array<TemplateTrigger>]
    /** Who may call it (`workflow.called`); `any` when absent. */
    readonly openTo?: "any" | "agent" | undefined
    /** The first step. */
    readonly start: string
    /** The graph's steps by key. */
    readonly nodes: Readonly<Record<string, GraphStep>>
    /**
     * What the template catalogue shows of it (name, one line, the published version and instant, what changed); carried on the @2
     * document. Absent: the catalogue shows the title, version 1. The providers it needs are DERIVED from its nodes' accounts, never typed.
     */
    readonly catalogue?: TemplateCatalogue | undefined
}

/** What the template catalogue shows of a graph (`GraphCatalogue` of the @2 document). */
export type TemplateCatalogue = GraphCatalogue

/** A template graph as compiled: its config, the @2 document, and the template nodes it places by id. */
export interface TemplateGraph {
    /** Tags the definition as a template graph. */
    readonly entry: "template-graph"
    /** `<module>.<workflow>`. */
    readonly key: string
    /** The graph as the @2 document. */
    readonly spec: GraphSpecV2
    /** The template nodes the graph places, by node id: the index the save problems read. */
    readonly nodes: ReadonlyMap<string, AnyTemplateNode>
}

/** What compiling a graph gives: the document and every problem decidable without the engine. */
export interface CompiledGraph {
    /** The compiled graph. */
    readonly graph: TemplateGraph
    /** Every problem decidable without the engine. */
    readonly problems: ReadonlyArray<TemplateProblem>
}

/** What `defineTemplateAgent` takes. */
export interface TemplateAgentConfig {
    /** The agent's module key. */
    readonly key: string
    /** The agent's name in both languages. */
    readonly label: SpecText
    /** The providers the agent works with, in priority order: WHICH accounts, never operations. */
    readonly accounts: ReadonlyArray<ProviderKey>
    /** The agent's graphs, at least one. */
    readonly graphs: readonly [TemplateGraph, ...Array<TemplateGraph>]
    /** The key of one of `graphs`. */
    readonly primary: string
}

/** A template agent as defined. */
export interface TemplateAgent extends TemplateAgentConfig {
    /** Tags the definition as a template agent. */
    readonly entry: "template-agent"
}
