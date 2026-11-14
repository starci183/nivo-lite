import type { ParamBinding, ParamBindings } from "../node/memory.contracts"
import type { ProviderKey, TriggerVerb } from "../names"
import type { JsonObject, JsonValue, Namespaced, SpecText } from "../schema/schema.types"
import type { TriggerCondition, WorkflowContract, WorkflowEntry, WorkflowOutcome } from "./workflow-contract"

/*
 * GraphSpec `nivo/agent-graph@2`: what `defineTemplateGraph` compiles to and what the engine stores and runs. It sits beside `@1` until the
 * dev re-seed; `@1` documents are not read as `@2` (no migration of documents: every template is re-seeded at one current version).
 *
 * What @2 changes against @1:
 * - a node step carries ONE `mode` (`auto | ask`: the step's, else its node's; `nivo-frame.rights`) and `accounts`, its providers ordered by
 *   priority (alternatives); no `kind`, no `connectionId` (bound at install), no per-tool mode. The read schema still takes this lane's
 *   older `accounts: [{ provider, operations }]` (no `mode`) and gives the current form.
 * - `triggers` is the verb array (`{ verb, args?, accounts?, where? }`, each verb at most once); the old `trigger` envelope and the `grant` are DERIVED by the
 *   engine (from the verbs and from the steps' nodes), never written.
 * - every step is a member of one discriminated union on `kind`: `node` (a template node), and the control steps `if`, `loop`,
 *   `call-workflow`, `outcome`. Control steps keep `core.*` step ids (`core.outcome` and `core.call-workflow` unchanged; `core.loop`
 *   is `over` / `until` by `params.mode`; `core.if` takes `when`, an expression), and the list stays FLAT (a loop goes to its body by
 *   its `body` route; a body step with no `next` or a body branch with no route ends one item / one round). The graph as written is
 *   ACYCLIC: the one way round is a `loop`, whose cycle the engine draws. `callWorkflows` compiles to `if` + `call-workflow` pairs.
 * - the old `for-each` step (`core.for-each`) of stored drafts is still parsed, and read as a `loop` / `over`.
 * - a body step names its loop (`loop`): the save checks and the per-item ledger path (`loopKey[itemKey].bodyKey`) read it, never guess it.
 * - a routing node names the output member it routes by (`routeBy`); `@1` read `branch` always.
 * - the first step starts the run (as in @1); `title` and `key` are the template's.
 */

/** The schema id of an agent graph spec, version 2. */
export type GraphSpecV2SchemaId = "nivo/agent-graph@2"

/** How a node's calls run: by themselves (`auto`), or only after a person approved the call (`ask`). One per node, declared by it. */
export type Mode = "auto" | "ask"

/**
 * Every explicit model id a node may name -> true. Open (as `ToolNames`): the host's vocabulary adds its ids by declaration merging; the SDK
 * declares the one every node runs today and the cheap one.
 */
export interface ModelNames {
    /** The Claude Sonnet 5.5 model. */
    "claude-sonnet-5-5": true
    /** The Claude Haiku 5.5 model. */
    "claude-haiku-5-5": true
}

/** One explicit model a node may name. */
export type ModelId = keyof ModelNames & string

/** `auto` (the engine picks per call by the step's weight) or an explicit model. */
export type ModelChoice = "auto" | ModelId

/** The id of a template node: `<module>.<feature>`, one node = one feature. */
export type NodeId = Namespaced

/**
 * One trigger at the head of a graph: the verb, its args, the providers whose accounts it listens on, its conditions (owner
 * key `triggerOneSource2026_11_12`, CORRECTED: a graph names each purpose once, and the engine binds ONE source per underlying STREAM).
 */
export interface GraphV2Trigger {
    /** The verb, as `TriggerNames` declares it. */
    readonly verb: TriggerVerb
    /** The args of the verb (`{ preset: "daily" }` for the clock); absent for none. */
    readonly args?: JsonObject | undefined
    /**
     * The providers whose accounts carry the event, each the agent's and each once (a package cannot know a workspace's accounts): at
     * bind time EVERY attached account of a listed provider is a source when the streams differ (three mailboxes = three sources); two
     * accounts reading the SAME stream (SePay and Casso on one bank account) wait for the founder's pick. Never empty; absent for a verb
     * of the engine's own road (the clock, a timer, the team chat, a workflow call, the website form).
     */
    readonly accounts?: ReadonlyArray<ProviderKey> | undefined
    /** What a wake must meet; absent takes every wake. (How long a burst settles is the trigger declaration's `settle`, not the graph's.) */
    readonly where?: ReadonlyArray<TriggerCondition> | undefined
}

/** What every step carries. */
interface GraphV2StepBase {
    /** The key of the step in its graph: unique, what refs and routes name. */
    readonly key: string
    /** For a step of a loop body: the key of that loop. Absent outside a body. */
    readonly loop?: string | undefined
}

/** A template node placed in the graph. */
export interface GraphV2NodeStep extends GraphV2StepBase {
    /** Marks the step as a node call. */
    readonly kind: "node"
    /** The template node it runs. */
    readonly step: NodeId
    /** Its params and its input, bound by member: fixed values or refs at any depth (the engine splits them by the two schemas). */
    readonly params: ParamBindings
    /** The model its AI calls use (the node's); absent for a node that never calls the AI (ruling B7). */
    readonly model?: ModelChoice | undefined
    /** How its calls run: the step's mode when the workflow set one, else its node's. Always written. */
    readonly mode: Mode
    /**
     * The providers (`zalo_oa`, `sepay`, `crm`) it may act through, in priority order, as the node declares them narrowed or reordered by
     * the step. Empty for NIVO's own tools only; always written.
     */
    readonly accounts: ReadonlyArray<ProviderKey>
    /** False for a side node (skipped when none of its providers is bound); absent for a blocking one. */
    readonly blocking?: false | undefined
    /** The step after it, for a node that does not route; absent ends the run (or the item, inside a body). */
    readonly next?: string | undefined
    /** For a routing node: the output member that names the route. */
    readonly routeBy?: string | undefined
    /** For a routing node: the step each route goes to, one per route name the node declares. */
    readonly routes?: Readonly<Record<string, string>> | undefined
    /** What the ENGINE does when the step ends unsuccessfully (`StepUnsuccessfulSpec`); absent: today's road (the step reports nothing itself). */
    readonly unsuccessful?: StepUnsuccessfulSpec | undefined
}

/** What the run does after the engine told the team of an unsuccessful step: its own exit (`continue`), or its declared outcome (`end`). */
export type UnsuccessfulThen = "continue" | "end"

/** One fact the team notice of an unsuccessful step carries: a label in both languages and its value, fixed or read by a ref. */
export interface NoticeFactSpec {
    /** The label a person reads, in the team's language. */
    readonly label: SpecText
    /** The value: a fixed one or a ref, resolved when the step ended (a null value is left out of the notice). */
    readonly value: ParamBinding
}

/**
 * A step's unsuccessful ending, as stored (R68): when the step ends in a TYPED non-success the graph does not route on (a customer send
 * refused other than `route_held`, an approval declined, the node's `cannot`), the ENGINE posts ONE team notice (the workflow, the step,
 * the typed reason and `facts`) and the run follows `then`. `then` is always written (the compile resolves its default).
 */
export interface StepUnsuccessfulSpec {
    /** `continue`: the step's own exit; `end`: the run goes to the outcome step `outcome`. */
    readonly then: UnsuccessfulThen
    /** With `end`: the key of the outcome step (outside every loop) the run ends at. */
    readonly outcome?: string | undefined
    /** What the notice says beside the reason, in order, at most `UNSUCCESSFUL_FACTS_MAX`. */
    readonly facts: ReadonlyArray<NoticeFactSpec>
}

/** An `until` loop's unsuccessful ending, as stored: when it runs out of rounds the engine posts the team notice, then the run takes `exhausted`. */
export interface LoopUnsuccessfulSpec {
    /** What the notice says beside the rounds, in order, at most `UNSUCCESSFUL_FACTS_MAX`. */
    readonly facts: ReadonlyArray<NoticeFactSpec>
}

/** A data condition: the engine's expression language over refs (`StoredExpr`). */
export interface GraphV2IfStep extends GraphV2StepBase {
    /** Marks the step as a branch. */
    readonly kind: "if"
    /** The step id of the branch. */
    readonly step: "core.if"
    /** The condition; its refs carry `default: null` so an absent value compares as null. */
    readonly params: { readonly when: StoredExpr }
    /**
     * `yes` when it holds, `no` when it does not. A branch with no route ends the ITEM (or the ROUND) inside a loop body (the engine's
     * loop goes back to the loop step: what `endItem` / `endRound` compile to) and ends the RUN outside one (only a compiled
     * `callWorkflows` writes no `no`; outside a body `yes` is always written).
     */
    readonly routes: { readonly yes?: string | undefined; readonly no?: string | undefined }
    /** The question the map shows on the condition, in the workspace's words ("Đủ tiền?"); absent: the generic word. */
    readonly label?: SpecText | undefined
}

/** A ref as stored: the `ParamRef` form. */
export interface StoredRef {
    /** The path of the value this reference reads. */
    readonly $ref: string
    /** The value used when the reference resolves to nothing. */
    readonly default?: JsonValue | undefined
    /** `previous`: inside an `until` body, the referenced body step's output of the round before (the default in round 1). */
    readonly round?: "previous" | undefined
}

/**
 * A comparison operator of an expression: `eq` / `ne` by canonical JSON, the order operators, and `contains` (the left text holds the
 * right text as an exact substring).
 */
export type CompareOp = "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "contains"

/** The order operators: they compare two numbers or two ISO 8601 instants, nothing else. */
export type OrderOp = "lt" | "lte" | "gt" | "gte"

/** A presence operator of an expression. */
export type PresenceOp = "present" | "absent"

/**
 * One comparison as stored: `eq` / `ne` by canonical JSON, the order operators on two numbers or two ISO instants, `contains` on two
 * texts. `caseFold` (only on `contains`, only when declared) compares the two texts folded by `caseFolded` (locale-free simple folding).
 */
export interface StoredCompare {
    /** The comparison or presence operator. */
    readonly op: CompareOp
    /** The reference the check reads. */
    readonly ref: StoredRef
    /** The value the reference is compared against, or a second reference. */
    readonly value: JsonValue | StoredRef
    /** True when the comparison ignores letter case. */
    readonly caseFold?: true | undefined
}

/** One presence test as stored: present = not null, not empty text, not an empty list. */
export interface StoredPresence {
    /** Whether the reference must be present or absent. */
    readonly op: PresenceOp
    /** The reference the check reads. */
    readonly ref: StoredRef
}

/** A leaf of an expression as stored. */
export type StoredLeaf = StoredCompare | StoredPresence

/** Every part holds. */
export interface StoredAnd {
    /** The expressions that must all hold. */
    readonly and: readonly [StoredExpr, ...Array<StoredExpr>]
}

/** At least one part holds. */
export interface StoredOr {
    /** The expressions of which at least one must hold. */
    readonly or: readonly [StoredExpr, ...Array<StoredExpr>]
}

/** The part does not hold. */
export interface StoredNot {
    /** The expression that must not hold. */
    readonly not: StoredExpr
}

/**
 * The engine's expression language, as stored (`loop.until`, `ifNode.when`, the checks of `callWorkflows`): a leaf, or `and` / `or` /
 * `not` over expressions. Bounded at save (`EXPR_TOO_DEEP`: depth at most `EXPR_DEPTH_MAX`, a leaf being depth 1; `EXPR_TOO_LARGE`: at
 * most `EXPR_LEAVES_MAX` leaves). The old `all` / `any` (one level) are read as `and` / `or` by the schema and never written.
 */
export type StoredExpr = StoredLeaf | StoredAnd | StoredOr | StoredNot

/**
 * A timed checkpoint between two rounds of an `until` loop: exactly one unit, a whole number (`LOOP_EVERY_INVALID` outside minutes
 * 1-1440, hours 1-720, days 1-30).
 */
export type LoopEvery =
    | { readonly minutes: number; readonly hours?: never; readonly days?: never }
    | { readonly hours: number; readonly minutes?: never; readonly days?: never }
    | { readonly days: number; readonly minutes?: never; readonly hours?: never }

/** An `until` loop that stops by MEANING: when the body node `route` (a routing node of the body) takes its route `stop`. */
export interface LoopUntilRoute {
    /** The key of a routing node of the body. */
    readonly route: string
    /** The route name of that node that stops the loop. */
    readonly stop: string
}

/** What an `until` loop stops on: an expression over refs (by DATA), or a route of a body node (by MEANING). */
export type LoopUntil = StoredExpr | LoopUntilRoute

/** The params of a loop over a list. */
export interface GraphV2LoopOverParams {
    /** Marks the loop as running over a list. */
    readonly mode: "over"
    /** The list, a ref. */
    readonly items: StoredRef
    /**
     * The field path of an item that identifies it (`id`, `order.id`), or `"."` (`LOOP_ITEM_SELF_KEY`): the item itself, on a list of
     * texts or numbers; absent: its index.
     */
    readonly itemKey?: string | undefined
    /** The cap: 1 to `LOOP_OVER_CAP` (50); the items past it are held, never run. */
    readonly max: number
    /** The body step whose output the loop gathers per item; absent: every item's `output` is null. */
    readonly collect?: string | undefined
    /** How many items run at once: 1 to `LOOP_CONCURRENCY_CAP` (5). Items are independent: a failed item ends that item only. */
    readonly concurrency: number
}

/** The params of a loop until a condition. */
export interface GraphV2LoopUntilParams {
    /** Marks the loop as running until a condition holds. */
    readonly mode: "until"
    /** Checked after every round; when it holds the loop goes `next`. */
    readonly until: LoopUntil
    /** The most rounds: 1 to `LOOP_UNTIL_CAP` (10); past it without the condition the run goes `exhausted`. */
    readonly max: number
    /** A timed checkpoint wait between two rounds; absent: the next round starts at once. */
    readonly every?: LoopEvery | undefined
}

/** A loop over a list: its body (the steps whose `loop` is this key) once per item, gathering the `collect` step's output. */
export interface GraphV2LoopOverStep extends GraphV2StepBase {
    /** The kind of step. */
    readonly kind: "loop"
    /** The step id of the loop. */
    readonly step: "core.loop"
    /** What the loop goes over. */
    readonly params: GraphV2LoopOverParams
    /** The first step of the body. */
    readonly routes: { readonly body: string }
    /** The step after the loop; absent ends the run. */
    readonly next?: string | undefined
    /** The loop's name on the map, in the workspace's words; absent: the generic word. */
    readonly label?: SpecText | undefined
}

/** The words of an `until` loop's two ways out, as the map shows them on the loop's frame. */
export interface LoopExitLabels {
    /** The way out when the condition holds ("Thoát khi đơn đã trả"); absent: the generic word. */
    readonly until?: SpecText | undefined
    /** The way out after the last round ("Hết 6 vòng mà chưa trả"); absent: the generic word. */
    readonly exhausted?: SpecText | undefined
}

/** A loop until a condition: its body once per round, the condition checked after each round. */
export interface GraphV2LoopUntilStep extends GraphV2StepBase {
    /** The kind of step. */
    readonly kind: "loop"
    /** The step id of the loop. */
    readonly step: "core.loop"
    /** The loop's stop condition and pace. */
    readonly params: GraphV2LoopUntilParams
    /** The first step of the body, and where the run goes when `max` rounds passed without the condition. */
    readonly routes: { readonly body: string; readonly exhausted: string }
    /** The engine tells the team when the loop runs out of rounds (`LoopUnsuccessfulSpec`); absent: it goes to `exhausted` with no notice. */
    readonly unsuccessful?: LoopUnsuccessfulSpec | undefined
    /**Where the run goes when the condition holds. */
    readonly next: string
    /** The loop's name on the map, in the workspace's words ("Tư vấn"); absent: the generic word. */
    readonly label?: SpecText | undefined
    /** The words of its two ways out on the map; absent: the generic words. */
    readonly exits?: LoopExitLabels | undefined
}

/** A loop: `over` a list, or `until` a condition (`params.mode`). The only legal way round in a graph. */
export type GraphV2LoopStep = GraphV2LoopOverStep | GraphV2LoopUntilStep

/**
 * The retired for-each step: only read from graphs stored before `core.loop` existed.
 *
 * @deprecated The loop before `core.loop` (stored drafts): still PARSED by `graphSpecV2Schema`, which reads it as a `loop` / `over`
 * (`concurrency` 1: sequential, as it ran). Never written, never a member of `GraphV2Step`.
 */
export interface GraphV2LegacyForEachStep extends GraphV2StepBase {
    /** The kind of step. */
    readonly kind: "for-each"
    /** The step id of the retired for-each. */
    readonly step: "core.for-each"
    /** What the retired for-each goes over. */
    readonly params: {
        readonly items: StoredRef
        readonly max: number
        readonly collect: string
        readonly itemKey?: string | undefined
    }
    /** The route the body of the retired for-each takes. */
    readonly routes: { readonly body: string }
    /** The step that follows; absent at the end of the graph. */
    readonly next?: string | undefined
}

/** An end hand-off to another workflow: its params are `core.call-workflow`'s, unchanged. */
export interface GraphV2CallWorkflowStep extends GraphV2StepBase {
    /** The kind of step. */
    readonly kind: "call-workflow"
    /** The step id of the workflow call. */
    readonly step: "core.call-workflow"
    /** Which workflow is called and with what inputs. */
    readonly params: {
        readonly agent: string
        readonly workflow: string
        readonly version: number | "latest"
        /** The target's inputs by name: fixed values or refs. */
        readonly inputs: ParamBindings
    }
    /** The step that follows; absent at the end of the graph. */
    readonly next?: string | undefined
}

/** A named business end: its params are `core.outcome`'s, unchanged. */
export interface GraphV2OutcomeStep extends GraphV2StepBase {
    /** Marks the step as the end of the run. */
    readonly kind: "outcome"
    /** The step id of the outcome. */
    readonly step: "core.outcome"
    /** The outcome the run ends with and the values it reports. */
    readonly params: { readonly outcome: string; readonly outputs: ParamBindings }
    /** The step that follows; absent at the end of the graph. */
    readonly next?: string | undefined
    /** The outcome's words ("Đã trả"); absent: its key. */
    readonly label?: SpecText | undefined
}

/**
 * One test a waited event must meet beyond its verb (`GraphV2WaitOn.match`): its supplied `member` equals (`eq`) or contains (`contains`,
 * `caseFold` as `contains` declares it) the value, a fixed one or a ref the engine reads when the wait begins (an order's code).
 */
export interface GraphV2WaitMatch {
    /** The member of the trigger's payload that is compared. */
    readonly member: string
    /** The comparison or presence operator. */
    readonly op: "eq" | "contains"
    /** The value compared against. */
    readonly value: JsonValue | StoredRef
    /** True when the comparison ignores letter case. */
    readonly caseFold?: true | undefined
}

/**
 * One trigger a wait listens for: its key (the route it takes, the `trigger` of the output), its verb, the trigger conditions on the
 * event's members (`where`, as a graph trigger's) and the tests against the run's data (`match`). With no `match`, an event is the
 * wait's when it is about the run's SUBJECT (the same contact or conversation, or the same value of a member the verb declares its
 * subject by); with a `match`, the match decides which event is the run's.
 */
export interface GraphV2WaitOn {
    /** The key the arriving trigger is filed under. */
    readonly key: string
    /** The trigger verb the wait listens for. */
    readonly verb: TriggerVerb
    /** The conditions the trigger must satisfy. */
    readonly where?: ReadonlyArray<TriggerCondition> | undefined
    /** The conditions the trigger's payload must match. */
    readonly match?: ReadonlyArray<GraphV2WaitMatch> | undefined
}

/** The params of a wait: its triggers (1 to `WAIT_TRIGGERS_MAX`) and how long it waits (`LoopEvery` units and bounds). */
export interface GraphV2WaitParams {
    /** The triggers the wait listens for. */
    readonly on: readonly [GraphV2WaitOn, ...Array<GraphV2WaitOn>]
    /** How long the wait lasts before it gives up. */
    readonly timeout: LoopEvery
}

/**
 * A wait on the SAME run (`wait({ for, timeout, next })`): the run stops (no person is asked) until one event of its triggers about the
 * run comes, or the timeout; it goes on along the route of what came (`routes[<key>]`, `routes.timeout`). Its output is
 * `{ trigger: <key>, event: <the event's supplied members> }` or `{ trigger: "timeout" }`.
 */
export interface GraphV2WaitStep extends GraphV2StepBase {
    /** Marks the step as a wait. */
    readonly kind: "wait"
    /** The step id of the wait. */
    readonly step: "core.wait"
    /** What the wait listens for and for how long. */
    readonly params: GraphV2WaitParams
    /** One route per trigger key and `timeout`. */
    readonly routes: Readonly<Record<string, string>>
    /** What the run waits for, in the workspace's words ("Chờ tiền về"); absent: the generic word. */
    readonly label?: SpecText | undefined
}

/**
 * A hand-back (`handBack({ wait, next? })`): the event the named wait took (in the same round) is not this run's business, so the engine
 * offers it on, once, to the next run waiting for it and then to the graphs registered on it; this run goes on at `next`, or its round /
 * the run ends there. It sits only on a trigger route of that wait (never on `timeout`: no event came).
 */
export interface GraphV2HandBackStep extends GraphV2StepBase {
    /** Marks the step as a hand-back. */
    readonly kind: "hand-back"
    /** The step id of the hand-back. */
    readonly step: "core.hand-back"
    /** The key of the wait whose event is handed back. */
    readonly params: { readonly wait: string }
    /** The step that follows; absent: the round (inside a loop body) or the run ends here. */
    readonly next?: string | undefined
    /** The hand-back's words on the map ("Trả lại tin"); absent: the generic word. */
    readonly label?: SpecText | undefined
}

/** One step of a @2 graph. */
export type GraphV2Step =
    | GraphV2NodeStep
    | GraphV2IfStep
    | GraphV2LoopStep
    | GraphV2CallWorkflowStep
    | GraphV2OutcomeStep
    | GraphV2WaitStep
    | GraphV2HandBackStep

/**
 * What the template catalogue shows of a graph: its name and one line, the version the author publishes it at, the instant it was
 * published and what changed in it. Carried on the document so the engine's catalogue reads it from the graph itself, never typed again.
 */
export interface GraphCatalogue {
    /** The name in the catalogue. */
    readonly name: SpecText
    /** One line on what it does for the shop. */
    readonly summary: SpecText
    /** The version the author publishes, a whole number from 1; a re-publish with other content takes the next one. */
    readonly version: number
    /** When this version was published (ISO 8601). */
    readonly publishedAt: string
    /** What changed in this version, as the catalogue lists it. */
    readonly notes: SpecText
    /**
     * True when the engine installs the graph ACTIVE on an agent of its module at the agent's creation or seed (a graph every agent
     * of the module must run from the start, such as its team-chat turn); absent or false, a graph that is not the agent's `primary`
     * is installed as a draft the owner turns on. The agent's `primary` graph is installed active either way.
     */
    readonly seedActive?: boolean | undefined
}

/** One agent graph as data, version 2. The first step starts the run. */
export interface GraphSpecV2 {
    /** The id of the graph schema this document follows. */
    readonly schema: GraphSpecV2SchemaId
    /** `<module>.<workflow>`. */
    readonly key: string
    /** The module of the agent that runs it: the part of `key` before the dot. */
    readonly moduleKey: string
    /** The words of the workflow. */
    readonly title: SpecText
    /** The inputs a run needs: what every trigger supplies, and what a caller maps. */
    readonly contract: WorkflowContract
    /** What starts a run; one event reaching the graph through two triggers starts ONE run (the engine's dedupe). */
    readonly triggers: readonly [GraphV2Trigger, ...Array<GraphV2Trigger>]
    /** Who may call it. */
    readonly entry: WorkflowEntry
    /** The named business ends, derived from the outcome steps (outputs typed from their refs). */
    readonly outcomes: ReadonlyArray<WorkflowOutcome>
    /** What the template catalogue shows of it; absent: the title, version 1, the re-seed's instant. */
    readonly catalogue?: GraphCatalogue | undefined
    /** The steps; the first starts the run; a body follows its loop. */
    readonly nodes: readonly [GraphV2Step, ...Array<GraphV2Step>]
}

