import type { TriggerCondition } from "../../graph/workflow-contract"
import type { ProviderKey, TriggerNames, TriggerVerb } from "../../names"
import { LOOP_CONCURRENCY_CAP, LOOP_OVER_CAP } from "../../graph/graph-spec-v2"
import type { LoopEvery } from "../../graph/graph-spec-v2.types"
import type { JsonValue } from "../../schema/schema.types"
import type {
    AndExpr,
    CallVersion,
    CallWorkflowGraphStep,
    CallWorkflowsGraphStep,
    CompareCondition,
    Expr,
    Expr3,
    GraphStep,
    IfGraphStep,
    LeafCondition,
    ListedCall,
    LoopGraphStep,
    LoopOverGraphStep,
    LoopUntilGraphStep,
    NodeGraphStep,
    NodeWiring,
    NotExpr,
    OrExpr,
    OrderValue,
    OutcomeGraphStep,
    HandBackGraphStep,
    PresenceCondition,
    Ref,
    RefOrValue,
    RefPath,
    WaitGraphStep,
    WaitMatch,
    WaitTimeout,
    WaitTrigger,
    TemplateTrigger,
    UntilCondition,
} from "./graph-builder.types"
import type { AnyTemplateNode } from "./template-example"

/** Whether a leaf is a presence test. */
export const isPresenceCondition = (leaf: LeafCondition): leaf is PresenceCondition =>
    leaf.op === "present" || leaf.op === "absent"

/** The options of a ref: what it holds when the source has not run or holds nothing. */
export interface RefOptions {
    /** What the ref reads when its source holds nothing; absent: null. */
    readonly default?: JsonValue | undefined
    /**
     * `previous`: legal only on a `steps.<key>` ref inside an `until` loop body to a step of the SAME body, with a `default`: it reads that
     * step's output of the round before, the default in round 1 (how a talk loop carries its draft; coordinator ruling R13). A generic loop
     * capability: the engine keeps the previous round's outputs of the body until the step runs again.
     */
    readonly round?: "previous" | undefined
}

/** A ref as stored, with its default and its round only when given. */
const refOf = <T>(path: string, options: RefOptions | undefined): Ref<T> => ({
    $ref: path,
    ...(options?.default === undefined ? {} : { default: options.default }),
    ...(options?.round === undefined ? {} : { round: options.round }),
})

/** A ref to what woke the run (`trigger.<input>`), a step's output (`steps.<key>.output.<path>`) or a lead fact (`lead.<fact>`). */
export const ref = <T = never>(path: RefPath, options?: RefOptions): Ref<T> => refOf<T>(path, options)

/** Inside an `over` loop body: the current item (`item`), a member of it (`item.<path>`), or its position (`item.$index`). */
export const item = <T = never>(path?: string, options?: RefOptions): Ref<T> =>
    refOf<T>(path === undefined || path === "" ? "item" : `item.${path}`, options)

/**
 * Inside an `until` loop body: the number of the round, from 1 (stored `item.$round`: a round is the iteration of an `until` loop as an
 * item is of an `over` one; `item.$index` is the round less one). Any other `item.*` is refused in an `until` body (`GRAPH_REF_TYPE`).
 */
export const round = (): Ref<number> => ({ $ref: "item.$round" })

/** The condition that a value is present: not null, not empty text, not an empty list. */
export const present = (value: Ref<JsonValue>): PresenceCondition => ({ op: "present", ref: value })

/** The condition that a value is absent: null, empty text or an empty list. */
export const absent = (value: Ref<JsonValue>): PresenceCondition => ({ op: "absent", ref: value })

/** The condition that a value equals another, by canonical JSON (`1` is not `"1"`). */
export const equals = (value: Ref<JsonValue>, to: RefOrValue): CompareCondition => ({ op: "eq", ref: value, value: to })

/** The condition that a value does not equal another. */
export const notEquals = (value: Ref<JsonValue>, to: RefOrValue): CompareCondition => ({
    op: "ne",
    ref: value,
    value: to,
})

/** The options of `contains`: `caseFold` compares the two texts folded (locale-free simple case folding, `caseFolded`). */
export interface ContainsOptions {
    /** Compare the two texts folded to one case (locale-free simple folding) instead of exactly. */
    readonly caseFold: true
}

/**
 * The text holds the part as an exact substring (case as given; folded on both sides with `{ caseFold: true }`): an integrity comparison of
 * two data fields, as `equals` is. A side that is no text at run makes the leaf unknown (it does not hold); a save that can tell refuses it
 * (`EXPR_TYPE_MISMATCH`).
 */
export const contains = (text: Ref<JsonValue>, part: Ref<JsonValue> | string, options?: ContainsOptions): CompareCondition => ({
    op: "contains",
    ref: text,
    value: part,
    ...(options?.caseFold === true ? { caseFold: true } : {}),
})

/** The condition that a number (an ISO instant) is greater (later) than another. */
export const gt = (value: Ref<JsonValue>, than: OrderValue): CompareCondition => ({ op: "gt", ref: value, value: than })

/** The condition that a number (an ISO instant) is greater (later) than or equal to another. */
export const gte = (value: Ref<JsonValue>, than: OrderValue): CompareCondition => ({ op: "gte", ref: value, value: than })

/** The condition that a number (an ISO instant) is less (earlier) than another. */
export const lt = (value: Ref<JsonValue>, than: OrderValue): CompareCondition => ({ op: "lt", ref: value, value: than })

/** The condition that a number (an ISO instant) is less (earlier) than or equal to another. */
export const lte = (value: Ref<JsonValue>, than: OrderValue): CompareCondition => ({ op: "lte", ref: value, value: than })

/** Every part holds. Its parts are at most 3 deep, so the whole is at most 4 (`EXPR_DEPTH_MAX`): deeper does not compile. */
export const and = <const P extends readonly [Expr3, ...Array<Expr3>]>(...parts: P): AndExpr<P[number]> => ({ and: parts })

/** At least one part holds. Its parts are at most 3 deep. */
export const or = <const P extends readonly [Expr3, ...Array<Expr3>]>(...parts: P): OrExpr<P[number]> => ({ or: parts })

/** The part does not hold. It is at most 3 deep. */
export const not = <const P extends Expr3>(part: P): NotExpr<P> => ({ not: part })

/** What a trigger may be given besides its verb; the args follow the verb's own names. */
export interface TriggerOptions<V extends TriggerVerb> {
    /** The verb's own arguments, named as the verb declares them. */
    readonly args?: TriggerNames[V]["args"] | undefined
    /**
     * The providers whose accounts carry the event (`[PROVIDER.imap]`: every attached mailbox of the workspace is a source; `[PROVIDER.sepay,
     * PROVIDER.casso]`: both feeds, one source per bank account); absent for a verb of the engine's own road.
     */
    readonly accounts?: ReadonlyArray<ProviderKey> | undefined
    /** Conditions on the event's params that must all hold for the trigger to wake the graph. */
    readonly where?: ReadonlyArray<TriggerCondition> | undefined
}

/**
 * A trigger at the head of a graph: the verb, with the args, the providers and conditions given (how a burst settles is the trigger declaration's `settle`) (an empty provider list is none).
 * A graph names each verb at most once (`TRIGGER_PURPOSE_DUPLICATE`): two sources of one purpose are one trigger with several accounts.
 */
export const trigger = <V extends TriggerVerb>(verb: V, options?: TriggerOptions<V>): TemplateTrigger => ({
    verb,
    ...(options?.args === undefined ? {} : { args: options.args }),
    ...(options?.accounts === undefined || options.accounts.length === 0 ? {} : { accounts: [...options.accounts] }),
    ...(options?.where === undefined ? {} : { where: options.where }),
})

/** The options of a trigger a wait listens for: a graph trigger's `where`, and the tests against the run's data (`match`). */
export interface WaitTriggerOptions {
    /** Conditions on the waited event's params that must all hold for it to count. */
    readonly where?: ReadonlyArray<TriggerCondition> | undefined
    /** Tests of the event's members against the run's own data, read when the wait begins. */
    readonly match?: ReadonlyArray<WaitMatch> | undefined
}

/** One trigger of a `wait`: the verb, the conditions on the event's members (`where`) and the tests against the run's data (`match`). */
export const waitFor = <V extends TriggerVerb>(verb: V, options?: WaitTriggerOptions): WaitTrigger => ({
    verb,
    ...(options?.where === undefined ? {} : { where: options.where }),
    ...(options?.match === undefined ? {} : { match: options.match }),
})

/** A test of a waited event: its supplied `member` holds the part (`contains`, case folded with `{ caseFold: true }`). */
export const memberContains = (member: string, part: RefOrValue, options?: ContainsOptions): WaitMatch => ({
    member,
    op: "contains",
    value: part,
    ...(options?.caseFold === true ? { caseFold: true } : {}),
})

/** A test of a waited event: its supplied `member` equals the value (canonical JSON, as `equals`). */
export const memberEquals = (member: string, value: RefOrValue): WaitMatch => ({ member, op: "eq", value })

/** What `wait` takes: the triggers by key (1 to 5), the timeout, and the step of each key and of `timeout`. */
export interface WaitWiring<K extends string> {
    /** The triggers the wait listens for, each under the key its route is named by. */
    readonly for: Readonly<Record<K, WaitTrigger>>
    /** How long the run stays parked before the `timeout` route is taken. */
    readonly timeout: WaitTimeout
    /** The step each trigger key goes to, and the step `timeout` goes to: every key, no other. */
    readonly next: Readonly<Record<NoInfer<K> | "timeout", string>>
}

/**
 * A wait on the SAME run: it stops until one of its triggers' events about the run comes (or the event its `match` names), or the
 * timeout, then goes on along `next[<key>]` / `next.timeout`. Its output is `{ trigger: <key>, event }` (the event's supplied members)
 * or `{ trigger: "timeout" }`: a later step refs `steps.<wait>.output.event.<member>` on the route of that key.
 */
export const wait = <const K extends string>(wiring: WaitWiring<K>): WaitGraphStep => ({
    kind: "wait",
    on: wiring.for,
    timeout: wiring.timeout,
    next: wiring.next,
})

/** What `handBack` takes: the wait whose event is handed back, and the step after it. */
export interface HandBackWiring {
    /** The key of the wait whose event (taken in the same round) is not this run's business. */
    readonly wait: string
    /** The step after the hand-back, or `endRound` in a loop body; absent: the round (in a body) or the run ends there. */
    readonly next?: string | undefined
}

/**
 * Hands the event a wait took back: the engine offers it, once, to the next run waiting for it and then to the graphs registered on
 * it, so a message that is not this run's business is never lost. It sits on a trigger route of that wait (never `timeout`: no event
 * came), `GRAPH_HAND_BACK_NO_EVENT` otherwise.
 */
export const handBack = (wiring: HandBackWiring): HandBackGraphStep => ({
    kind: "hand-back",
    wait: wiring.wait,
    next: wiring.next ?? null,
})

/** The bindings as a plain record of refs and values. */
const recordOf = (bindings: object | undefined): Readonly<Record<string, RefOrValue>> =>
    Object.fromEntries(
        Object.entries(bindings ?? {}).filter((entry): entry is [string, RefOrValue] => entry[1] !== undefined),
    )

/** The routes of a wiring as a plain record of step keys. */
const routesOf = (routes: object): Readonly<Record<string, string>> =>
    Object.fromEntries(
        Object.entries(routes).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    )

/** A template node placed in the graph. */
export const node = <N extends AnyTemplateNode>(definition: N, wiring: NodeWiring<N> = {}): NodeGraphStep => ({
    kind: "node",
    node: definition,
    input: recordOf(wiring.input),
    params: recordOf(wiring.params),
    mode: wiring.mode ?? null,
    accounts: wiring.accounts ?? null,
    next: wiring.next ?? null,
    routes: wiring.routes === undefined ? null : routesOf(wiring.routes),
})

/** The body a `loop` over a list is wired with: its start, its keyed steps and the step whose output the loop gathers. */
interface LoopOverWiringBody {
    /** The first step of the body. */
    readonly start: string
    /** The body's steps by key. */
    readonly nodes: Readonly<Record<string, GraphStep>>
    /** The body step whose output the loop gathers per item; absent: each item's `output` is null. */
    readonly collect?: string | undefined
}

/** The body an `until` loop is wired with: its start and its keyed steps; it gathers no output. */
interface LoopUntilWiringBody {
    /** The first step of the body. */
    readonly start: string
    /** The body's steps by key. */
    readonly nodes: Readonly<Record<string, GraphStep>>
    /** Absent: an `until` loop gathers no output per round. */
    readonly collect?: never
}

/** What `loop` takes to run its body once per item of a list. Items are independent: a failed item ends that item only. */
export interface LoopOverWiring {
    /** The list. */
    readonly over: Ref<ReadonlyArray<JsonValue>>
    /**
     * The FIELD PATH of an item that identifies it (`id`, `order.id`), or `"."`: the item itself, for a list of plain texts or numbers
     * (a list of service codes keyed by the code); absent: its index. Data, never a function.
     */
    readonly key?: string | undefined
    /**
     * The body: a keyed sub-branch; `ifNode` and a routing node are legal in it, `callWorkflow(s)`, `outcome` and another `loop` are not.
     * Every branch and route in it names a body step or `endItem`; a node's `next` may name `endItem` or be left out. `collect`: the body
     * step whose output the loop gathers per item; absent: each item's `output` is null.
     */
    readonly body: LoopOverWiringBody
    /** The most items it runs, a whole number from 1 to 50; absent: 50. The items past it are held (`held`), never run. */
    readonly max?: number | undefined
    /** How many items run at once, 1 to 5; absent: 5. A graph may lower it, never raise it. */
    readonly concurrency?: 1 | 2 | 3 | 4 | 5 | undefined
    /** The step after the loop; absent: the run ends there. */
    readonly next?: string | undefined
    /** Absent: only an `until` loop has an end condition. */
    readonly until?: never
    /** Absent: only an `until` loop waits between rounds. */
    readonly every?: never
    /** Absent: only an `until` loop has a route for running out of rounds. */
    readonly exhausted?: never
}

/**
 * The rounds an `until` loop may run: 1 to 10 (`LOOP_UNTIL_CAP`), or up to 30 (`LOOP_UNTIL_WAIT_CAP`) when its body parks at a `wait`;
 * the save check judges which (`LOOP_MAX_INVALID`).
 */
export type LoopRounds =
    | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30

/**
 * What `loop` takes to run its body round after round until a condition holds, checked after each round (the body's end, a step with
 * no `next` or `endRound`, starts the check): by DATA (an `Expr` over refs; a ref into the body reads the round just run) or by MEANING
 * (`{ route, stop }`: the body's routing node `route` took its route `stop` in the round just run).
 */
export interface LoopUntilWiring {
    /** The condition that ends the loop, checked after each round. */
    readonly until: UntilCondition
    /** The body, as an `over` body but with no `collect` (the loop's `last` is the output of the step that ended the final round). */
    readonly body: LoopUntilWiringBody
    /** The most rounds: mandatory, 1 to 10, or up to 30 when the body holds a `wait`. */
    readonly max: LoopRounds
    /** A timed checkpoint wait between two rounds (`{ minutes: 15 }`, `{ hours: 1 }`, `{ days: 1 }`); absent: none. */
    readonly every?: LoopEvery | undefined
    /** Where the run goes when the condition holds. */
    readonly next: string
    /** Where the run goes when `max` rounds passed without the condition (usually: report to the team). Mandatory. */
    readonly exhausted: string
    /** Absent: an `until` loop runs rounds, not items. */
    readonly over?: never
    /** Absent: rounds are numbered, not keyed. */
    readonly key?: never
    /** Absent: rounds run one after another. */
    readonly concurrency?: never
}

/** What `loop` takes: `over` a list or `until` a condition; a config holding both, or members of the other, does not compile. */
export type LoopWiring = LoopOverWiring | LoopUntilWiring

/** Whether a wiring loops over a list. */
const isOverWiring = (wiring: LoopWiring): wiring is LoopOverWiring => wiring.over !== undefined

/** The one control loop: `over` a list (`loop({ over, key, body, max, concurrency, next })`) or `until` a condition. */
export const loop = (wiring: LoopWiring): LoopGraphStep => {
    if (isOverWiring(wiring)) {
        const over: LoopOverGraphStep = {
            kind: "loop",
            mode: "over",
            over: wiring.over,
            itemKey: wiring.key ?? null,
            max: wiring.max ?? LOOP_OVER_CAP,
            concurrency: wiring.concurrency ?? LOOP_CONCURRENCY_CAP,
            body: { start: wiring.body.start, nodes: wiring.body.nodes, collect: wiring.body.collect ?? null },
            next: wiring.next ?? null,
        }
        return over
    }
    const until: LoopUntilGraphStep = {
        kind: "loop",
        mode: "until",
        until: wiring.until,
        max: wiring.max,
        every: wiring.every ?? null,
        body: { start: wiring.body.start, nodes: wiring.body.nodes },
        next: wiring.next,
        exhausted: wiring.exhausted,
    }
    return until
}

/**
 * The target that ends the ITEM of a loop body: a branch of an `ifNode`, a route of a routing node or a node's `next` in a body may
 * name it, and the loop goes on with the next item. Legal only inside a body (`GRAPH_END_ITEM_OUTSIDE`). It is no step key (a key is
 * lower-case words), and the compile writes what the engine's loop reads as the end of an iteration: the branch, route or `next` left out.
 */
export const endItem = "$end-item" as const

/** The type of `endItem`. */
export type EndItem = typeof endItem

/**
 * The target that ends the ROUND of an `until` body: the same mark as `endItem` (one compiled form: the branch, route or `next` left
 * out), named for reading. The end of a round starts the loop's condition check.
 */
export const endRound: EndItem = endItem

/** What `ifNode` takes. */
export interface IfWiring {
    /** The condition the step tests; it holds, or it does not (unknown counts as not holding). */
    readonly when: Expr
    /** The step when the condition holds (the `yes` route); in a loop body it may be `endItem` / `endRound`. Always given. */
    readonly yes: string | EndItem
    /**
     * The step when it does not hold; in a loop body it may be `endItem` / `endRound`. Absent: inside a body the ITEM (ROUND) ends,
     * outside a body the RUN ends there (GraphSpec @2: an `if` with no `no` route).
     */
    readonly no?: string | EndItem | undefined
}

/**
 * A data condition: `yes` when it holds, `no` when it does not, the same names as the compiled step's `routes`. The keys are never
 * `then` / `else`: an object with a `then` member is a thenable, and `await` (or a promise resolve) would call into it.
 * Branching on MEANING is a routing node's, never this.
 */
export const ifNode = (wiring: IfWiring): IfGraphStep => ({
    kind: "if",
    when: wiring.when,
    yes: wiring.yes,
    no: wiring.no ?? null,
})

/** What `callWorkflow` takes. */
export interface CallWorkflowWiring {
    /** The key of the agent whose workflow is called. */
    readonly agent: string
    /** The key of the workflow called. */
    readonly workflow: string
    /** `latest` when absent. */
    readonly version?: CallVersion | undefined
    /** What the called workflow is given, by input name. */
    readonly input: Readonly<Record<string, RefOrValue>>
    /** The step after the call; absent: the run ends there. */
    readonly next?: string | undefined
}

/** An end hand-off: the engine builds the payload and the key. */
export const callWorkflow = (wiring: CallWorkflowWiring): CallWorkflowGraphStep => ({
    kind: "call-workflow",
    agent: wiring.agent,
    workflow: wiring.workflow,
    version: wiring.version ?? "latest",
    input: wiring.input,
    next: wiring.next ?? null,
})

/** What `callWorkflows` takes. */
export interface CallWorkflowsWiring {
    /** The calls to make, each skipped when its list is empty. */
    readonly calls: readonly [ListedCall, ...Array<ListedCall>]
    /** The step after the calls; absent: the run ends there. */
    readonly next?: string | undefined
}

/** Several end hand-offs: each list passed ONCE, a call skipped when its list is empty. */
export const callWorkflows = (wiring: CallWorkflowsWiring): CallWorkflowsGraphStep => ({
    kind: "call-workflows",
    calls: wiring.calls,
    next: wiring.next ?? null,
})

/** What `outcome` takes. */
export interface OutcomeWiring {
    /** The business end this step names. */
    readonly name: string
    /** What the end reports, by member; absent: nothing. */
    readonly output?: Readonly<Record<string, RefOrValue>> | undefined
    /** The step after the end; absent: the run ends there. */
    readonly next?: string | undefined
}

/** A named business end, with the outputs it hands on. */
export const outcome = (wiring: OutcomeWiring): OutcomeGraphStep => ({
    kind: "outcome",
    name: wiring.name,
    output: wiring.output ?? {},
    next: wiring.next ?? null,
})
