import type { z } from "../schema/zod-entry"
import type { JsonValue } from "../schema/schema.types"

/*
 * The data-flow law of NIVO workflows (owner-approved 2026-11-09), as types. Every node declares what it answers (`output`) and how it
 * fails on business grounds (`failure`); the engine writes each step's outcome into the ONE memory of the lead (customer) the run serves,
 * which spans every workflow and run of that lead; a param of a graph node is a fixed value or a ref read from that memory at run time;
 * a new workflow version is refused at save when a ref is broken. Shared by the engine (be), the editor (web) and the nodes (blocks-core).
 */

// ---------------------------------------------------------------------------------------------------------------------------------
// Refs
// ---------------------------------------------------------------------------------------------------------------------------------

/** The text form of a ref in the editor and in hand-written specs: `= steps.order.output.address`. The stored form is `ParamRef`. */
export const REF_TEXT_PREFIX = "="

/**
 * Where a ref reads from:
 * - `trigger.<path>`: what woke this run (the trigger's params, its channel, the customer line).
 * - `steps.<nodeKey>.output.<path>` / `steps.<nodeKey>.error.<path>`: the outcome of a node of THIS workflow in THIS run.
 * - `lead.<field>`: a fact of the lead, from the lead record or promoted by a node's `facts` (an address once known is never asked again).
 * - `workflows.<namespace>.steps.<nodeKey>.output.<path>`: the latest outcome of a node of ANOTHER workflow of the same lead.
 * - `item.<path>` / `item.$index`: inside the body of a for-each step only, the element of the list being worked on.
 * - `out.<field>`: on the steps after an outcome step (won, lost, ...) only, the output fields that outcome
 *   declared, as the outcome step bound them; this is what a call-workflow step maps onto the next workflow's inputs.
 */
export type RefRoot = "trigger" | "steps" | "lead" | "workflows" | "item" | "out"

/** Which part of a step's outcome a `steps.*` ref reads: what it answered, or its business failure. */
export type StepPart = "output" | "error"

/**
 * A param bound at run time. `default` is what it holds when the source has not run or holds nothing; a ref whose source may not have
 * run before this step (not a dominator) is refused at save unless it has one.
 */
export interface ParamRef {
    /** The ref, without the `=`: `trigger.channel`, `steps.order.output.address`, `lead.address`, `workflows.sales.consult.steps...`. */
    readonly $ref: string
    /** What the param holds when the ref finds nothing. */
    readonly default?: JsonValue | undefined
    /**
     * `previous`: inside an `until` loop body, the ref reads its body step's output of the ROUND BEFORE (the default in round 1): how a
     * round carries what the last one decided (coordinator ruling R13, 2026-11-14). Absent: the value as it stands now.
     */
    readonly round?: "previous" | undefined
}

/** One param of a graph node: a fixed value as written, or a ref resolved at run time. */
export type ParamBinding = JsonValue | ParamRef

/** The params of a graph node by field. Replaces `Record<string, JsonValue>` on `GraphSpecNode.params` and on an end hand-off. */
export type ParamBindings = Readonly<Record<string, ParamBinding>>

/** A ref as parsed: its root, the workflow namespace and node it names, the part of the outcome and the path inside it. */
export interface ParsedRef {
    /** Where it reads from. */
    readonly root: RefRoot
    /** For `workflows.*`: the namespace of the workflow (`<moduleKey>.<workflowKey>`); null otherwise. */
    readonly namespace: string | null
    /** For `steps.*` and `workflows.*`: the node key; null otherwise. */
    readonly nodeKey: string | null
    /** For `steps.*` and `workflows.*`: the part of the outcome; null otherwise. */
    readonly part: StepPart | null
    /** The members inside the root (or the part); empty for the whole value. A number steps into a list. */
    readonly path: ReadonlyArray<string>
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The for-each step
// ---------------------------------------------------------------------------------------------------------------------------------

/** The node kind of the for-each step (built by the contracts lane): it runs its body once per element of its `items` param. */
export const LOOP_STEP = "core.for-each"

/** The route of a for-each node to the first node of its body; its `next` is the node after the loop. A body node with no next ends one iteration. */
export const LOOP_BODY_ROUTE = "body"

/** The param of a for-each node that holds the list (a ref to an array; its element schema types `item.*`). */
export const LOOP_ITEMS_PARAM = "items"

/** The member of `item.*` that reads the position of the element, from 0. */
export const LOOP_INDEX_MEMBER = "$index"

/** The param of a for-each node that caps the list: at most this many items run, the rest are counted in `held`. */
export const LOOP_MAX_PARAM = "max"

/** The most items one loop runs (the cap `max` may lower, never raise). */
export const LOOP_MAX = 50

/**
 * The param of a for-each node that names the body node whose output the loop gathers per item (`nivo/agent-graph@2`). Absent (a `@1`
 * document): the output of the body node the item's iteration ended on.
 */
export const LOOP_COLLECT_PARAM = "collect"

/**
 * The param of a for-each node that names the member of an item that is its identity (a business id: `orderId`). Absent: the item's
 * index. The identity is inside every body step's key, so the same call for two items is two calls and the same item re-run is one.
 */
export const LOOP_ITEM_KEY_PARAM = "itemKey"

/** The longest item identity kept as it is; a longer one (or one with a character a step key cannot carry) is kept as a digest. */
export const LOOP_ITEM_KEY_MAX = 64

/** Two items of one list share an identity: the loop stops before any item runs (never a silent collapse into one). */
export const FOREACH_ITEM_KEY_DUPLICATE = "FOREACH_ITEM_KEY_DUPLICATE"

/** An item has no usable identity under the declared `itemKey` (absent, or not a string or a finite number): the loop stops before any item runs. */
export const FOREACH_ITEM_KEY_MISSING = "FOREACH_ITEM_KEY_MISSING"

/** One item in a for-each node's output: its identity and the output of the `collect` node (null when the item's route did not reach it). */
export interface LoopItemOutput {
    /** The item's identity (`itemKey`'s value, bounded, or its index). */
    readonly key: string
    /** The gathered output, or null. */
    readonly output: JsonValue
}

/** The items past the cap: how many did not run in this round and the identity of the first of them. */
export interface LoopHeld {
    /** How many items were not run. */
    readonly count: number
    /** The identity of the first one not run. */
    readonly firstKey: string
}

/**
 * What a for-each node answers once every item ran: the steps after the loop read only this, never a body step directly. `items` holds,
 * per item run and in order, its identity and the gathered output; `held` the items past the cap, or null when every item ran.
 */
export interface LoopOutput {
    /** Each item that ran, in order. */
    readonly items: ReadonlyArray<LoopItemOutput>
    /** The items past the cap, or null. */
    readonly held: LoopHeld | null
    /**
     * The gathered output of each item, in order (`items[i].output`).
     * @deprecated A bridge for the `@1` templates that still read `steps.<loop>.output.results`; removed with their conversion.
     */
    readonly results: ReadonlyArray<JsonValue>
}

/** The element a body step works on. */
export interface LoopItem {
    /** The element. */
    readonly value: JsonValue
    /** Its position, from 0. */
    readonly index: number
}

/** The opening and the closing of an item's identity in a body step's key, and what parts it from the body node. */
const ITERATION_OPEN = "["
const ITERATION_CLOSE_THEN_NODE = "]."

/**
 * The key of a body step in one item: `<loopKey>[<itemKey>].<nodeKey>` (the step path of the ledger, the memory and the stops), so a
 * resume runs only what that item did not do, and the same call of two items is two calls. `itemKey` is the bounded identity.
 */
export const iterationKeyOf = (loopKey: string, itemKey: string, nodeKey: string): string =>
    `${loopKey}${ITERATION_OPEN}${itemKey}${ITERATION_CLOSE_THEN_NODE}${nodeKey}`

/** The parts of a body step's key. */
export interface IterationKeyParts {
    /** The for-each node. */
    readonly loopKey: string
    /** The item's identity. */
    readonly itemKey: string
    /** The body node. */
    readonly nodeKey: string
}

/**
 * The parts of a body step's key, or null for the key of a step outside every loop. A node key never holds `]` or `.`, so the body
 * node is what follows the last `].`, and the loop is what precedes the first `[`.
 */
export const iterationKeyPartsOf = (stepKey: string): IterationKeyParts | null => {
    const close = stepKey.lastIndexOf(ITERATION_CLOSE_THEN_NODE)
    const open = stepKey.indexOf(ITERATION_OPEN)
    if (close < 0 || open <= 0 || open > close) return null
    const nodeKey = stepKey.slice(close + ITERATION_CLOSE_THEN_NODE.length)
    return nodeKey === "" ? null : { loopKey: stepKey.slice(0, open), itemKey: stepKey.slice(open + 1, close), nodeKey }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * The node kind of an outcome step: it names one of the workflow's declared outcomes (`params.outcome`) and binds each of that outcome's
 * output fields (the other params, fixed or ref). It answers those values as its output; the steps after it read them as `out.<field>`.
 * `out.*` is valid in a node only when an outcome step dominates it; the nearest such step decides which outcome types it.
 */
export const OUTCOME_STEP = "core.outcome"

/** The param of an outcome step that names the outcome. */
export const OUTCOME_PARAM = "outcome"

// ---------------------------------------------------------------------------------------------------------------------------------
// Node outputs and business failures
// ---------------------------------------------------------------------------------------------------------------------------------


/** The members every business failure carries, whatever the node; a node's `failure` schema adds its own fields under `fields`. */
export interface StepFailure<F = Readonly<Record<string, JsonValue>>> {
    /** A stable code a condition can branch on: `address_missing`, `out_of_stock`, `payment_mismatch`. */
    readonly code: string
    /** The catalog key of the words of the failure, for the owner (`nodeFailure<Node><Code>`). */
    readonly messageKey: string
    /** The words in the run's language, as the node wrote them. */
    readonly message: string
    /** The node's own typed fields of the failure (the missing field, the stock left...). */
    readonly fields: F
}

/** How a step ended, as memory keeps it. */
export type StepOutcomeStatus = "done" | "failed" | "passed_over"

/**
 * What a node kind declares about its outcome, kept next to its `params` and `input` on the node definition (`NodeConfig`). `output` is
 * the existing zod output; `failure` and `facts` are new and optional.
 */
export interface NodeOutcomeDeclaration<O extends z.ZodType = z.ZodType, F extends z.ZodType = z.ZodType> {
    /** What the node answers when it succeeds; the schema refs into `steps.<key>.output.*` are typed against. */
    readonly output: O
    /** The `fields` of a business failure; refs into `steps.<key>.error.fields.*` are typed against it. Absent: the node never fails so. */
    readonly failure?: F | undefined
    /**
     * Lead facts this node's output proves, by lead field then the dotted path in its output (`{ address: "deliveryAddress" }`): the
     * engine writes them into the lead's memory when the step is done, so a later step reads `lead.address` instead of asking again.
     */
    readonly facts?: Readonly<Partial<Record<LeadFact, string>>> | undefined
    /** Output members that hold a secret or personal data: masked when memory is read for display, never when a step reads it. */
    readonly sensitive?: Readonly<Record<string, Sensitivity>> | undefined
}

/**
 * The facts of a lead that memory keeps across workflows. A closed list, so `lead.<field>` refs are validated at save. `careOptOut`
 * (the customer asked to be left alone) and `occasions` (the dates they care about) are what the consult learned for care: memory is
 * their one home (the lead record keeps no copy).
 */
export const LEAD_FACTS: readonly [
    "name",
    "phone",
    "email",
    "address",
    "recipientName",
    "recipientPhone",
    "deliveryAt",
    "occasion",
    "channel",
    "lastOrderId",
    "lastOrderCode",
    "lastPaymentId",
    "careOptOut",
    "occasions",
] = [
    "name",
    "phone",
    "email",
    "address",
    "recipientName",
    "recipientPhone",
    "deliveryAt",
    "occasion",
    "channel",
    "lastOrderId",
    "lastOrderCode",
    "lastPaymentId",
    "careOptOut",
    "occasions",
]

/** One fact of a lead. */
export type LeadFact = (typeof LEAD_FACTS)[number]

/** How a value is masked for display: a secret is never shown; personal data shows its shape only (`09*****12`). */
export type Sensitivity = "secret" | "pii"

/** The lead facts that are personal data, masked for display by default. */
export const PII_FACTS: ReadonlyArray<LeadFact> = ["name", "phone", "email", "address", "recipientName", "recipientPhone"]

// ---------------------------------------------------------------------------------------------------------------------------------
// The lead memory
// ---------------------------------------------------------------------------------------------------------------------------------

/** A file or picture in memory: never its bytes, a ref the owner's store resolves to a short-lived address. */
export interface FileRef {
    /** Tag that marks a stored value as a file. */
    readonly $file: "image" | "file"
    /** The id of the stored file (chat file, media, receipt). */
    readonly id: string
    /** The media type. */
    readonly mime: string
    /** The file name, when known. */
    readonly name?: string | undefined
}

/** One step's outcome in memory. */
export interface StepMemory {
    /** How it ended. */
    readonly status: StepOutcomeStatus
    /** What it answered (files as `FileRef`); null for a failure or a step passed over. */
    readonly output: JsonValue
    /** Its business failure; null otherwise. */
    readonly error: StepFailure | null
    /** The run it ran in. */
    readonly runId: string
    /** The graph version the run ran. */
    readonly versionId: string
    /** When it ended, ISO text. */
    readonly at: string
}

/**
 * Who a memory belongs to: the contact (the engine's person), else the conversation of a person no contact holds yet (the same key the
 * freeze uses). When the contact is named mid-run, the engine re-keys the conversation's entries to it (`LeadMemoryStore.adopt`).
 */
export interface MemorySubject {
    /** `contact:<id>` or `conversation:<id>`. */
    readonly key: string
    /** The contact, when known. */
    readonly contactId: string | null
    /** The conversation, when known. */
    readonly conversationId: string | null
}

/** What a step reads: the whole memory of its lead, as one snapshot taken when the step starts. */
export interface LeadMemorySnapshot {
    /** Who it is about. */
    readonly subject: MemorySubject
    /** The facts of the lead (the lead record overlaid with the facts nodes promoted, newest wins). */
    readonly lead: Readonly<Partial<Record<LeadFact, JsonValue>>>
    /** The latest outcome of every node of every workflow of this lead, by namespace then node key. */
    readonly workflows: Readonly<Record<string, Readonly<Record<string, StepMemory>>>>
}

/** What a ref resolves against at run time. */
export interface RefScope {
    /** What woke this run. */
    readonly trigger: unknown
    /** The outcomes of the nodes of this run done before, by node key. */
    readonly steps: Readonly<Record<string, StepMemory>>
    /** The namespace of the workflow the run executes. */
    readonly namespace: string
    /** The lead's memory; null for a run about no customer (a schedule, a report). */
    readonly memory: LeadMemorySnapshot | null
    /** Inside a for-each body: the element of this iteration; absent elsewhere. */
    readonly item?: LoopItem | undefined
    /** After an outcome step: the values it bound for its outcome; absent elsewhere. */
    readonly out?: Readonly<Record<string, JsonValue>> | undefined
    /**
     * Inside an `until` body: the outcomes of the body's steps in the ROUND BEFORE, by node key (empty in round 1); what a ref
     * `{ round: "previous" }` reads (coordinator ruling R13; the engine fills it). Absent elsewhere.
     */
    readonly previous?: Readonly<Record<string, StepMemory>> | undefined
}

/** One write of memory: the outcome of one step, under its workflow's namespace. Idempotent by (subject, runId, nodeKey). */
export interface MemoryWrite {
    /** Who it is about. */
    readonly subject: MemorySubject
    /** The workflow the run executes. */
    readonly namespace: string
    /** The workflow record, when the run is pinned to one. */
    readonly workflowId: string | null
    /** The agent of the run. */
    readonly agentId: string
    /** The node of the step. */
    readonly nodeKey: string
    /** The node kind (`sales.order-from-chat`). */
    readonly step: string
    /** The outcome. */
    readonly outcome: StepMemory
    /** The lead facts this outcome proves (from the node's `facts`), written into the lead's facts. */
    readonly facts: Readonly<Partial<Record<LeadFact, JsonValue>>>
    /** The run's trigger, written once per run under `trigger`. */
    readonly trigger: JsonValue
}

/** Who reads memory: a step reads raw values; display (run page, lead page, editor preview) reads them masked. */
export type MemoryReader = "step" | "display"

/**
 * The store of lead memory. Implemented once in the engine (`be/src/modules/domain/lead-memory`), on the contacts' memory table.
 * Every method is workspace-scoped.
 */
export interface LeadMemoryStore {
    /** The snapshot a step reads (raw), or the one display reads (masked). Null when the subject has no memory yet. */
    snapshot(workspaceId: string, subject: MemorySubject, reader: MemoryReader): Promise<LeadMemorySnapshot | null>
    /** The stored outcome of one node of one run: what resume and replay return instead of running the node (and its AI) again. */
    stepOf(workspaceId: string, subject: MemorySubject, runId: string, nodeKey: string): Promise<StepMemory | null>
    /** Writes one step's outcome and the facts it proves; a repeat of the same (runId, nodeKey) changes nothing. */
    write(workspaceId: string, write: MemoryWrite): Promise<void>
    /** Moves a conversation's entries to the contact it is, so the memory is one per person. */
    adopt(workspaceId: string, conversationId: string, contactId: string): Promise<void>
    /** Marks the contact's memory closed: retention counts from here. */
    closed(workspaceId: string, contactId: string, at: Date): Promise<void>
    /** Deletes what retention says is due; answers how many entries went. */
    sweep(workspaceId: string, now: Date): Promise<number>
}

/** The days each kind of memory entry is kept. */
export interface MemoryRetention {
    /** Days an entry stays after its lead closed. */
    readonly afterCloseDays: 30
    /** Days an open lead's entry stays after its last write. */
    readonly openIdleDays: 365
    /** Days a conversation's entry stays after its last write, when the conversation never became a lead. */
    readonly conversationIdleDays: 30
}

/**
 * How long memory is kept. Proposed policy: entries of a lead stay while the lead is open; 30 days after it closes they go (the lead
 * record itself, orders and payments stay - they are the business's own records). A lead that never closes keeps 365 days from its last
 * write. A conversation that never became a lead keeps 30 days from its last write.
 */
export const MEMORY_RETENTION: MemoryRetention = { afterCloseDays: 30, openIdleDays: 365, conversationIdleDays: 30 }

// ---------------------------------------------------------------------------------------------------------------------------------
// Save-time validation
// ---------------------------------------------------------------------------------------------------------------------------------

/** Why a new workflow version is refused for its params and refs. */
export type RefProblemCode =
    /** A param the node's schema does not have. */
    | "PARAM_UNKNOWN"
    /** A fixed value the node's schema refuses. */
    | "PARAM_INVALID"
    /** A ref that is not one of the four roots, or is malformed. */
    | "REF_SYNTAX"
    /** A ref to a node key the graph does not have. */
    | "REF_NODE_UNKNOWN"
    /** A ref to a member the source's output (or failure, or the lead facts) does not declare. */
    | "REF_FIELD_UNKNOWN"
    /** A ref whose source type the param cannot take. */
    | "REF_TYPE_MISMATCH"
    /** A ref to a node that may not have run before this step (not a dominator), with no default. */
    | "REF_NOT_DOMINATOR"
    /** A ref to the node itself or to a node after it. */
    | "REF_SELF"
    /** A ref to another workflow that this workspace does not have. */
    | "REF_WORKFLOW_UNKNOWN"
    /** An `item.*` ref outside the body of a for-each step. */
    | "REF_ITEM_OUTSIDE_LOOP"
    /** A ref from outside a for-each body to a step inside it: read the loop's output instead. */
    | "REF_LOOP_BODY"
    /** An `out.*` ref in a node no outcome step dominates. */
    | "REF_OUT_OUTSIDE_OUTCOME"
    /** An outcome step naming an outcome the workflow does not declare. */
    | "OUTCOME_UNKNOWN"

/** One refusal, with where it is and its words keyed for i18n (`workflowRef.<code>`, Vietnamese first). */
export interface RefProblem {
    /** Why. */
    readonly code: RefProblemCode
    /** The node whose param is at fault. */
    readonly nodeKey: string
    /** The param. */
    readonly field: string
    /** The ref as written, when the fault is in a ref. */
    readonly ref: string | null
    /** The catalog key of the words (`workflowRef.refNotDominator`). */
    readonly messageKey: string
    /** What the words are filled with (node, field, ref, expected and found types). */
    readonly params: Readonly<Record<string, string>>
}

/** A JSON type as the validator compares them; `unknown` matches anything. */
export type RefType = "string" | "number" | "integer" | "boolean" | "object" | "array" | "null" | "unknown"

/** What the validator needs besides the graph: the node kinds and the namespaces of the other workflows of the workspace. */
export interface RefValidationContext {
    /** The outcome declaration of each node kind, by node id. */
    readonly outcomes: ReadonlyMap<string, NodeOutcomeDeclaration>
    /** The params schema of each node kind, by node id. */
    readonly params: ReadonlyMap<string, z.ZodType>
    /** The input schema of each node kind, by node id: a graph node's `params` bind both. */
    readonly inputs: ReadonlyMap<string, z.ZodType>
    /** The other workflows a `workflows.*` ref may name, by namespace, with their graphs' node kinds by node key. */
    readonly workflows: ReadonlyMap<string, ReadonlyMap<string, string>>
    /**
     * The JSON type of each member of the workflow's input contract (`GraphSpec.contract.inputs`), which EVERY trigger of the workflow
     * supplies in full; members it does not declare are refused once it declares any. The system members (`TRIGGER_SYSTEM_MEMBERS`,
     * `channel` and `caller {agent, workflow, runId}` among them) are always there.
     */
    readonly trigger: Readonly<Record<string, RefType>>
    /** The output fields of each outcome the workflow declares, by outcome key then field (`GraphSpec.outcomes`); empty when none. */
    readonly workflowOutcomes?: ReadonlyMap<string, Readonly<Record<string, RefType>>> | undefined
}
