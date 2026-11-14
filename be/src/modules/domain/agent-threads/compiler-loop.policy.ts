import { createHash } from "node:crypto"
import { LOOP_CONCURRENCY_CAP, LOOP_ITEM_SELF_KEY, loopBodiesOf, type GraphSpec, type GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import {
    FOREACH_ITEM_KEY_DUPLICATE,
    FOREACH_ITEM_KEY_MISSING,
    LOOP_BODY_ROUTE,
    LOOP_COLLECT_PARAM,
    LOOP_ITEM_KEY_MAX,
    LOOP_ITEM_KEY_PARAM,
    LOOP_MAX,
    LOOP_MAX_PARAM,
    LOOP_STEP,
    iterationKeyOf,
    type LoopHeld,
} from "@nivo-lite/agent-sdk/node"
import type { GraphNodeStepInput } from "@modules/domain/agent-graphs"
import type { StepJson } from "@modules/domain/agent-runs"

/**
 * A for-each on a thread is a SEQUENTIAL CYCLE: the loop node goes to the first node of its body, every way out of the body (a node with
 * nothing after it, a branch with no route, a `stop`) goes back to the loop node, and the loop node, visited again, joins the iteration
 * that just ended and sends the thread into the next one, or, after the last, writes the summary as its output and follows its own exit.
 * One iteration runs at a time; the frame (`state.loop`) says which, so a thread that is driven again after a crash goes on in the
 * iteration it was in and never runs a joined one again. Each item has an IDENTITY (the declared `itemKey` member, else its index) that
 * is inside every body step's key (`<loop>[<item>].<node>`): the ledger, the memory and the stops of one item are its own, so a resume
 * re-runs only what that item did not finish. The loop gathers, per item, the output of its declared `collect` body node (a `@1`
 * document without one: the node the iteration ended on), runs at most `max` items and counts the rest as `held`. This file is the pure
 * part: the shape the compiler draws and the moves the node function makes. Nested loops are refused (a thread holds one frame).
 *
 * A loop whose `concurrency` is above 1 (a `loop({ over })` of `@2`) is a FAN-OUT instead (LangGraph's `Send`): the loop node sends
 * one branch per item of a WINDOW of `concurrency` items (the window is the cap: no other node sends), each branch runs the body for
 * its item on its own (`state.branch` names the item; its step keys are the sequential loop's), and every way out of the body comes
 * back to the loop node as a JOIN, recording the item in `state.branches` (a reducer channel: one record per item, so parallel items
 * never write one key). The loop node, visited again, waits while an item of the window runs, sends the next window once every item
 * of this one ended, and sums the loop after the last. An item that cannot complete is HELD (its stop is open, its record names the
 * node it stopped at): the other items of its window go on; the window then stops at the gate once, and the founder's decision sends
 * every held item back to its own failed node, no other node of any item running again. Concurrency 1 (`@1` documents, stored
 * `for-each` steps) stays the sequential cycle, unchanged.
 */

/** The value of one element of a loop's list, as a step input carries it. */
export type LoopItem = StepJson[string]

/** The loops of one version: each for-each node with its body, and the loop each body node belongs to. */
export interface LoopShapes {
    /** The members of each loop's body, by the loop node's key. */
    readonly bodies: ReadonlyMap<string, ReadonlySet<string>>
    /** The loop node each body node belongs to, by node key. */
    readonly loopOf: ReadonlyMap<string, string>
}

/** Why a version's loops cannot run on a thread. */
export type LoopProblemCode = "TEMPLATE_LOOP_NESTED" | "TEMPLATE_LOOP_SHARED"

/** One problem of a loop and the node it is at. */
export interface LoopProblem {
    /** The reason. */
    readonly code: LoopProblemCode
    /** The node key. */
    readonly at: string
}

/** Whether a node is a for-each. */
export const isLoopNode = (node: GraphSpecNode): boolean => node.step === LOOP_STEP

/** The loops of a version: every for-each node with the nodes reachable from its `body` route without passing through it again. */
export const loopShapesOf = (spec: GraphSpec): LoopShapes => {
    const loops = spec.nodes.filter((node) => isLoopNode(node)).map((node) => node.key)
    const found = loopBodiesOf(spec)
    const bodies = new Map(loops.map((key) => [key, found.get(key) ?? new Set<string>()]))
    const loopOf = new Map<string, string>()
    for (const [loop, body] of bodies) for (const key of body) loopOf.set(key, loop)
    return { bodies, loopOf }
}

/**
 * The problems of a version's loops on a thread: a for-each inside another one's body (a thread holds one frame), and a body node a
 * node outside the loop also leads to (its way out would go back to the loop where the graph means the end). Empty for a graph with
 * no loop.
 */
export const loopProblemsOf = (spec: GraphSpec, shapes: LoopShapes): ReadonlyArray<LoopProblem> => {
    const nested = [...shapes.bodies.keys()]
        .filter((loop) => shapes.loopOf.has(loop))
        .map((at): LoopProblem => ({ code: "TEMPLATE_LOOP_NESTED", at }))
    const shared = new Set<string>()
    for (const node of spec.nodes) {
        const own = shapes.loopOf.get(node.key)
        const body = shapes.bodies.get(node.key)
        const edges: ReadonlyArray<readonly [string, string]> = [
            ...Object.entries(node.routes ?? {}),
            ...(node.next === undefined ? [] : [["", node.next] satisfies [string, string]]),
        ]
        for (const [route, target] of edges) {
            const targetLoop = shapes.loopOf.get(target)
            // An edge into a body comes from a node of the same body, or is the loop's own `body` route.
            if (targetLoop === undefined || targetLoop === own) continue
            if (body !== undefined && targetLoop === node.key && route === LOOP_BODY_ROUTE) continue
            shared.add(target)
        }
    }
    return [...nested, ...[...shared].map((at): LoopProblem => ({ code: "TEMPLATE_LOOP_SHARED", at }))]
}

/** How a for-each node is set: the cap, the body node it gathers, the member that is an item's identity (as its params say them). */
export interface LoopSettings {
    /** The most items it runs, 1 to `LOOP_MAX`. */
    readonly max: number
    /** The body node whose output it gathers per item; null: the node an iteration ends on (a `@1` document). */
    readonly collect: string | null
    /** The member (a dotted path) of an item that is its identity; null: the index. */
    readonly itemKey: string | null
    /** How many items run at once, 1 to `LOOP_CONCURRENCY_CAP`; 1 is the sequential cycle. */
    readonly concurrency: number
}

/** The param of a loop node that says how many items run at once (`loop({ over, concurrency })`); absent: 1, sequential. */
export const LOOP_CONCURRENCY_PARAM = "concurrency"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** A whole number kept within 1 and `top`, or `fallback` for anything else. */
const boundedOf = (value: unknown, top: number, fallback: number): number =>
    typeof value === "number" && Number.isInteger(value) ? Math.min(Math.max(value, 1), top) : fallback

/** A non-empty text, or null. */
const nameOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/**
 * A loop node's settings, read from its params object as the graph wrote it (`nivo/agent-graph@1` or `@2`): `max` (a whole number,
 * kept within 1 and `LOOP_MAX`; absent or anything else = `LOOP_MAX`), `collect` and `itemKey` (fixed texts; absent = null), and
 * `concurrency` (a whole number kept within 1 and `LOOP_CONCURRENCY_CAP`: a graph may lower the cap, never raise it; absent or anything
 * else = 1, so a `@1` document and a stored `for-each` run sequentially, as they always ran).
 */
export const loopSettingsOf = (params: unknown): LoopSettings => {
    const given = isRecord(params) ? params : {}
    return {
        max: boundedOf(given[LOOP_MAX_PARAM], LOOP_MAX, LOOP_MAX),
        collect: nameOf(given[LOOP_COLLECT_PARAM]),
        itemKey: nameOf(given[LOOP_ITEM_KEY_PARAM]),
        concurrency: boundedOf(given[LOOP_CONCURRENCY_PARAM], LOOP_CONCURRENCY_CAP, 1),
    }
}

/** Whether a loop node's params make it a fan-out (`concurrency` above 1): the compiler and the node function read it alike. */
export const isFanoutLoop = (params: unknown): boolean => loopSettingsOf(params).concurrency > 1

/** The list a loop runs: the items it runs (at most `max`), the identity of each, the items past the cap, the node it gathers. */
export interface LoopList {
    /** The items that run, in order. */
    readonly items: ReadonlyArray<LoopItem>
    /** The identity of each of them, in the same order. */
    readonly keys: ReadonlyArray<string>
    /** The items past the cap, or null. */
    readonly held: LoopHeld | null
    /** The body node whose output the loop gathers, or null. */
    readonly collect: string | null
}

/** The codes a list is refused under before any item runs. */
export type LoopListCode = typeof FOREACH_ITEM_KEY_DUPLICATE | typeof FOREACH_ITEM_KEY_MISSING

/** Why a loop cannot start: the code, the item it is at (from 0), and the words of the stop. */
export interface LoopListRefused {
    /** `FOREACH_ITEM_KEY_DUPLICATE` or `FOREACH_ITEM_KEY_MISSING`. */
    readonly code: LoopListCode
    /** The item, from 0. */
    readonly index: number
    /** What the founder reads. */
    readonly text: string
}

/** A list the loop may run, or why it may not. */
export type LoopListing = ({ readonly kind: "listed" } & LoopList) | ({ readonly kind: "refused" } & LoopListRefused)

/** The first and the last character an item identity keeps as it is (printable ASCII), and the three a step key cannot carry. */
const KEY_CHAR_FIRST = 0x21
const KEY_CHAR_LAST = 0x7e
const KEY_CHARS_REFUSED: ReadonlySet<string> = new Set(["[", "]", ":"])

/** The prefix of an item identity kept as a digest, and how many hex characters of the digest it keeps. */
const DIGEST_PREFIX = "sha-"
const DIGEST_LENGTH = 40

/** Whether a character may stand in a step key as it is. */
const keyCharKept = (char: string): boolean => {
    const code = char.codePointAt(0) ?? 0
    return code >= KEY_CHAR_FIRST && code <= KEY_CHAR_LAST && !KEY_CHARS_REFUSED.has(char)
}

/**
 * An item identity as a step key carries it: as it is when it is at most `LOOP_ITEM_KEY_MAX` characters of printable ASCII other than
 * `[`, `]`, `:`; else a digest of it (`sha-<40 hex>`), so a key stays bounded and parseable whatever the business id is.
 */
export const boundedItemKeyOf = (raw: string): string =>
    raw.length <= LOOP_ITEM_KEY_MAX && [...raw].every((char) => keyCharKept(char))
        ? raw
        : `${DIGEST_PREFIX}${createHash("sha256").update(raw).digest("hex").slice(0, DIGEST_LENGTH)}`

/**
 * The identity an item gives under its loop's `itemKey` (a non-empty text or a finite number, a number as its decimal text), or null
 * when it gives none: the member at a dotted path, or, under `"."` (`LOOP_ITEM_SELF_KEY`), the item itself (an object, a list, a
 * boolean or null item then has no identity).
 */
const memberKeyOf = (item: LoopItem, path: string): string | null => {
    const value =
        path === LOOP_ITEM_SELF_KEY
            ? item
            : path.split(".").reduce<unknown>((at, member) => (isRecord(at) ? at[member] : undefined), item)
    if (typeof value === "string") return value === "" ? null : value
    return typeof value === "number" && Number.isFinite(value) ? String(value) : null
}

/** How a stop names an item's identity: the member path, `value` for the item itself (`"."`), `key` for the index. */
const keyNameOf = (itemKey: string | null): string => {
    if (itemKey === null) return "key"
    return itemKey === LOOP_ITEM_SELF_KEY ? "value" : itemKey
}

/**
 * The list a loop runs, from the list its `items` bind to and its settings: each item's identity (the `itemKey` member, bounded, or the
 * index), the first `max` items, and the rest as `held`. An item without an identity under a declared `itemKey`, or two items of the
 * list sharing one, refuse the whole list before any item runs: a business id that repeats would otherwise collapse two items into one.
 */
export const loopListingOf = (items: ReadonlyArray<LoopItem>, settings: LoopSettings): LoopListing => {
    const keys: Array<string> = []
    const seen = new Map<string, number>()
    for (const [index, item] of items.entries()) {
        const raw = settings.itemKey === null ? String(index) : memberKeyOf(item, settings.itemKey)
        if (raw === null)
            return {
                kind: "refused",
                code: FOREACH_ITEM_KEY_MISSING,
                index,
                text: `item ${String(index)} has no ${keyNameOf(settings.itemKey)} to key it by`,
            }
        const key = boundedItemKeyOf(raw)
        const first = seen.get(key)
        if (first !== undefined)
            return {
                kind: "refused",
                code: FOREACH_ITEM_KEY_DUPLICATE,
                index,
                text: `item ${String(index)} has the same ${keyNameOf(settings.itemKey)} as item ${String(first)}: ${key}`,
            }
        seen.set(key, index)
        keys.push(key)
    }
    const count = Math.min(items.length, settings.max)
    const firstHeld = keys[count]
    return {
        kind: "listed",
        items: items.slice(0, count),
        keys: keys.slice(0, count),
        held: firstHeld === undefined ? null : { count: items.length - count, firstKey: firstHeld },
        collect: settings.collect,
    }
}

/** How one item's iteration ended: its identity and the output the loop gathered for it (null when none was). */
export interface ThreadLoopJoin {
    /** The iteration, from 0. */
    readonly index: number
    /** The item's identity. */
    readonly key: string
    /** The gathered output, or null. */
    readonly output: LoopItem
}

/** A join, or null when none is there. */
export type OptionalThreadLoopJoin = ThreadLoopJoin | null

/** The output of the `collect` node in the iteration that runs, once that node completed in it. */
export interface ThreadLoopPick {
    /** The iteration, from 0. */
    readonly index: number
    /** The output of the `collect` node. */
    readonly output: LoopItem
}

/** A pick, or null before the `collect` node completed in the iteration that runs (and always for a loop with no `collect`). */
export type OptionalThreadLoopPick = ThreadLoopPick | null

/**
 * The loop in progress, as `state.loop` keeps it (plain JSON): the loop node, the iteration that runs, the items it runs and their
 * identities, what it gathers, the items past the cap, the iterations already joined, the `collect` node's output in the running
 * iteration and, between the end of an iteration and the loop node's next visit, how that iteration ended.
 */
export interface ThreadLoopFrame {
    /** The for-each node. */
    readonly nodeKey: string
    /** The iteration that runs, from 0. */
    readonly index: number
    /** The items that run, in order (at most the node's `max`). */
    readonly items: ReadonlyArray<LoopItem>
    /** The identity of each item, in the same order. */
    readonly keys: ReadonlyArray<string>
    /** The body node whose output the loop gathers, or null (the node an iteration ends on). */
    readonly collect: string | null
    /** The items past the cap, or null. */
    readonly held: LoopHeld | null
    /** The iterations joined so far, in order. */
    readonly joins: ReadonlyArray<ThreadLoopJoin>
    /** The `collect` node's output in the iteration that runs, or null. */
    readonly picked: OptionalThreadLoopPick
    /** How the iteration `index` ended, once a body node left the body; null while it runs. */
    readonly ended: OptionalThreadLoopJoin
    /** A fan-out only: how many items run at once (above 1); `index` is then the first item of the window that runs. */
    readonly concurrency?: number | undefined
    /** A fan-out only: true while the window stopped at the gate for its held items, so the next visit sends them back. */
    readonly gated?: boolean | undefined
}

/** The frame of the loop in progress, or null when no loop runs. */
export type OptionalThreadLoopFrame = ThreadLoopFrame | null

/** The first node of a loop's body, or null for a loop whose body is empty. */
export type OptionalLoopBody = string | null

/** The loop node a node's body belongs to, or undefined for a node outside every loop. */
export type OptionalLoopNode = string | undefined

/** What a body node's input carries in the iteration that runs: the element and the loop. */
export type IterationInput = Pick<GraphNodeStepInput, "item" | "loop">

/** One item in the loop's output: its identity and the gathered output. */
export interface ThreadLoopItemOutput {
    /** The item's identity. */
    readonly key: string
    /** The gathered output, or null. */
    readonly output: LoopItem
}

/** The output of a for-each once every item ran (the SDK's `LoopOutput`). */
export interface ThreadLoopSummary {
    /** Each item that ran, in order, with its gathered output. */
    readonly items: ReadonlyArray<ThreadLoopItemOutput>
    /** The items past the cap, or null. */
    readonly held: LoopHeld | null
    /** The gathered outputs in order (`items[i].output`): the deprecated bridge for the `@1` templates that read `results`. */
    readonly results: ReadonlyArray<LoopItem>
}

/** Where the loop node sends the thread on a visit. */
export type ThreadLoopMove =
    | {
          /** An iteration starts: the frame to write and the first body node. */
          readonly kind: "iterate"
          /** The new `state.loop`. */
          readonly frame: ThreadLoopFrame
          /** The first node of the body. */
          readonly goto: string
      }
    | {
          /** Every iteration ran (or none had to): the loop's output; `state.loop` is cleared and the loop's own exit follows. */
          readonly kind: "summed"
          /** The loop node's output. */
          readonly output: ThreadLoopSummary
      }

/** What the loop node finds on a visit: no iteration ended yet (it runs the node and starts), or an iteration to join. */
export type LoopVisit =
    | {
          /** First visit (or a frame of another loop): the node runs, checks the list, and the loop starts. */
          readonly kind: "start"
      }
    | {
          /** An iteration just ended: it is joined, and the next one starts or the loop is summed. */
          readonly kind: "join"
          /** The move. */
          readonly move: ThreadLoopMove
      }

/** A join as the frame keeps it, or null when the value is none. */
const joinOf = (value: unknown, keys: ReadonlyArray<string>): OptionalThreadLoopJoin => {
    if (!isRecord(value) || typeof value.index !== "number") return null
    const key = typeof value.key === "string" ? value.key : (keys[value.index] ?? String(value.index))
    return { index: value.index, key, output: value.output ?? null }
}

/** A pick as the frame keeps it, or null. */
const pickOf = (value: unknown): OptionalThreadLoopPick =>
    isRecord(value) && typeof value.index === "number" ? { index: value.index, output: value.output ?? null } : null

/** The held part as the frame keeps it, or null. */
const heldOf = (value: unknown): LoopHeld | null =>
    isRecord(value) && typeof value.count === "number" && typeof value.firstKey === "string"
        ? { count: value.count, firstKey: value.firstKey }
        : null

/** The identities a frame keeps: its own when they are one text per item, else each item's index (a frame written before keys). */
const keysOf = (value: unknown, count: number): ReadonlyArray<string> =>
    Array.isArray(value) && value.length === count && value.every((one: unknown) => typeof one === "string")
        ? value.map(String)
        : Array.from({ length: count }, (_, index) => String(index))

/** The frame `state.loop` holds, or null when no loop runs (or the value is not a frame). */
export const loopFrameOf = (value: unknown): OptionalThreadLoopFrame => {
    if (!isRecord(value)) return null
    const { nodeKey, index, items, joins } = value
    if (typeof nodeKey !== "string" || typeof index !== "number" || !Array.isArray(items) || !Array.isArray(joins)) return null
    const keys = keysOf(value.keys, items.length)
    return {
        nodeKey,
        index,
        items: items.map((item: unknown) => item ?? null),
        keys,
        collect: nameOf(value.collect),
        held: heldOf(value.held),
        joins: joins.flatMap((join: unknown) => joinOf(join, keys) ?? []),
        picked: pickOf(value.picked),
        ended: joinOf(value.ended, keys),
        ...(typeof value.concurrency === "number" && value.concurrency > 1 ? { concurrency: value.concurrency } : {}),
        ...(value.gated === true ? { gated: true } : {}),
    }
}

/** The output of a loop: each item that ran, in order, with its gathered output (null for an item no join holds), and the held part. */
export const loopSummaryOf = (
    list: Pick<ThreadLoopFrame, "keys" | "held">,
    joins: ReadonlyArray<ThreadLoopJoin>,
): ThreadLoopSummary => {
    const byIndex = new Map(joins.map((join) => [join.index, join]))
    const items = list.keys.map((key, index): ThreadLoopItemOutput => ({ key, output: byIndex.get(index)?.output ?? null }))
    return { items, held: list.held, results: items.map((item) => item.output) }
}

/** The move of a loop that starts: the first iteration, or the output at once for an empty list or a loop with no body. */
export const loopStarted = (loopKey: string, body: OptionalLoopBody, list: LoopList): ThreadLoopMove => {
    if (body === null || list.items.length === 0) return { kind: "summed", output: loopSummaryOf(list, []) }
    return {
        kind: "iterate",
        frame: {
            nodeKey: loopKey,
            index: 0,
            items: [...list.items],
            keys: [...list.keys],
            collect: list.collect,
            held: list.held,
            joins: [],
            picked: null,
            ended: null,
        },
        goto: body,
    }
}

/**
 * What the loop node finds on a visit: the iteration that ended, joined into the next move, when the frame is its own and says one
 * ended; otherwise a start.
 */
export const loopVisitOf = (loopKey: string, body: OptionalLoopBody, frame: OptionalThreadLoopFrame): LoopVisit => {
    if (frame?.nodeKey !== loopKey || frame.ended === null) return { kind: "start" }
    const joins = [...frame.joins.filter((join) => join.index !== frame.ended?.index), frame.ended]
    const next = frame.index + 1
    if (body !== null && next < frame.items.length)
        return {
            kind: "join",
            move: { kind: "iterate", frame: { ...frame, index: next, joins, picked: null, ended: null }, goto: body },
        }
    return { kind: "join", move: { kind: "summed", output: loopSummaryOf(frame, joins) } }
}

/** The identity of the item that runs. */
const runningKeyOf = (frame: ThreadLoopFrame): string => frame.keys[frame.index] ?? String(frame.index)

/**
 * The frame once a body node completed in the running iteration: the `collect` node's output is kept for the item (a later visit of
 * the same node in the same item replaces it); any other node leaves the frame as it is.
 */
export const iterationPicked = (frame: ThreadLoopFrame, nodeKey: string, output: LoopItem): ThreadLoopFrame =>
    frame.collect === nodeKey ? { ...frame, picked: { index: frame.index, output } } : frame

/**
 * The frame once the running iteration left the body, on a node whose output is `output` (null for a node passed over): the item
 * gathers the `collect` node's output when the loop declares one (null when the item's route never reached it), else `output`.
 */
export const iterationEnded = (frame: ThreadLoopFrame, output: LoopItem): ThreadLoopFrame => {
    const picked = frame.picked !== null && frame.picked.index === frame.index ? frame.picked.output : null
    return {
        ...frame,
        ended: { index: frame.index, key: runningKeyOf(frame), output: frame.collect === null ? output : picked },
    }
}

/**
 * The step key a node runs under: `<loop>[<item>].<node>` for a body node in the iteration that runs (`iterationKeyOf`: the ledger, the
 * memory and the stops of that item), else its node key.
 */
export const loopStepKeyOf = (nodeKey: string, inLoop: OptionalLoopNode, frame: OptionalThreadLoopFrame): string =>
    inLoop !== undefined && frame !== null && frame.nodeKey === inLoop
        ? iterationKeyOf(frame.nodeKey, runningKeyOf(frame), nodeKey)
        : nodeKey

/** What a body node's input carries in the iteration that runs: the element with its identity, and the loop. */
export const iterationInputOf = (frame: ThreadLoopFrame): IterationInput => ({
    item: { value: frame.items[frame.index] ?? null, index: frame.index, key: runningKeyOf(frame) },
    loop: { nodeKey: frame.nodeKey, index: frame.index, items: frame.items },
})

// ---------------------------------------------------------------------------------------------------------------------------------
// The fan-out (`concurrency` above 1): one LangGraph `Send` per item of a window, joined by the loop node through `state.branches`
// ---------------------------------------------------------------------------------------------------------------------------------

/** Whether a frame is a fan-out's. */
export const isFanoutFrame = (frame: ThreadLoopFrame): boolean => (frame.concurrency ?? 1) > 1

/** What a branch of a fan-out carries (`state.branch`): the loop, the item's place in the list and its identity. */
export interface LoopBranch {
    /** The loop node. */
    readonly loop: string
    /** The item, from 0. */
    readonly index: number
    /** The item's identity. */
    readonly key: string
}

/** A branch, or null outside one. */
export type OptionalLoopBranch = LoopBranch | null

/** A branch's value as a node reads it, or null outside a branch (or for a value that is no branch of a loop). */
export const loopBranchOf = (value: unknown): OptionalLoopBranch =>
    isRecord(value) && typeof value.loop === "string" && typeof value.index === "number" && typeof value.key === "string"
        ? { loop: value.loop, index: value.index, key: value.key }
        : null

/** The id of an item's record in `state.branches`: `<loop>[<item>]`. */
export const itemBranchIdOf = (loopKey: string, itemKey: string): string => `${loopKey}[${itemKey}]`

/** An item's place in a window: sent and running, ended with the output the loop gathers, held at a node, or joined. */
export type LoopItemRecord =
    | { readonly state: "running" }
    | { readonly state: "ended"; readonly output: LoopItem }
    | { readonly state: "held"; readonly nodeKey: string; readonly stepKey: string; readonly trouble: Readonly<Record<string, unknown>> }
    | { readonly state: "joined" }

/** A record, or null when the value is none. */
export type OptionalLoopItemRecord = LoopItemRecord | null

/** A record as `state.branches` keeps it, or null when the value is none. */
export const itemRecordOf = (value: unknown): OptionalLoopItemRecord => {
    if (!isRecord(value)) return null
    const { state, nodeKey, stepKey, trouble, output } = value
    if (state === "running" || state === "joined") return { state }
    if (state === "ended") return { state, output: (output ?? null) as LoopItem }
    if (state === "held" && typeof nodeKey === "string" && typeof stepKey === "string" && isRecord(trouble))
        return { state, nodeKey, stepKey, trouble }
    return null
}

/** One branch the loop node sends: the node it starts at (the body's first, or a held item's failed node) and the item. */
export interface LoopSendOf {
    /** The node. */
    readonly node: string
    /** The item. */
    readonly branch: LoopBranch
}

/** A held item of a window, in list order. */
export interface LoopHeldItem {
    /** The item, from 0. */
    readonly index: number
    /** Its identity. */
    readonly key: string
    /** The node it stopped at. */
    readonly nodeKey: string
    /** The step it stopped at (`<loop>[<item>].<node>`). */
    readonly stepKey: string
    /** The trouble its stop left (the node function's `ThreadTrouble`, plain JSON). */
    readonly trouble: Readonly<Record<string, unknown>>
}

/** Where the loop node of a fan-out sends the thread on a visit. */
export type FanoutMove =
    | {
          /** Branches go out (a window, or the held items back to their failed nodes): the frame and the records to write. */
          readonly kind: "fan"
          /** The new `state.loop`. */
          readonly frame: ThreadLoopFrame
          /** One per item sent. */
          readonly sends: ReadonlyArray<LoopSendOf>
          /** The records to write into `state.branches`, by id. */
          readonly records: Readonly<Record<string, LoopItemRecord>>
      }
    | {
          /** An item of the window still runs: nothing is written, nothing sent; its own join visits again. */
          readonly kind: "wait"
      }
    | {
          /** Every item of the window ended or is held, and some are held: the window stops at the gate once for all of them. */
          readonly kind: "gate"
          /** The frame, marked `gated`. */
          readonly frame: ThreadLoopFrame
          /** The held items, in list order (never empty). */
          readonly held: ReadonlyArray<LoopHeldItem>
      }
    | {
          /** Every item ran (or none had to): the loop's output; `state.loop` and `state.branches` are cleared. */
          readonly kind: "summed"
          /** The loop node's output. */
          readonly output: ThreadLoopSummary
      }

/** The items of the window that starts at `from`: their indexes. */
const windowOf = (count: number, from: number, concurrency: number): ReadonlyArray<number> =>
    Array.from({ length: Math.max(0, Math.min(concurrency, count - from)) }, (_, at) => from + at)

/** The identity of the item at `index` of a frame. */
const keyAtOf = (frame: Pick<ThreadLoopFrame, "keys">, index: number): string => frame.keys[index] ?? String(index)

/** The move that sends the items `indexes` of a frame to `node` (each as a branch of its own), each recorded as running. */
const sentTo = (frame: ThreadLoopFrame, sends: ReadonlyArray<{ readonly node: string; readonly index: number }>): FanoutMove => ({
    kind: "fan",
    frame,
    sends: sends.map(
        (one): LoopSendOf => ({ node: one.node, branch: { loop: frame.nodeKey, index: one.index, key: keyAtOf(frame, one.index) } }),
    ),
    records: Object.fromEntries(
        sends.map((one) => [itemBranchIdOf(frame.nodeKey, keyAtOf(frame, one.index)), { state: "running" } satisfies LoopItemRecord]),
    ),
})

/** The move that sends the window starting at `from` into the body. */
const windowSent = (frame: ThreadLoopFrame, body: string, from: number): FanoutMove =>
    sentTo(
        { ...frame, index: from, gated: false, picked: null, ended: null },
        windowOf(frame.items.length, from, frame.concurrency ?? 1).map((index) => ({ node: body, index })),
    )

/** The move of a fan-out that starts: its first window, or the output at once for an empty list or a loop with no body. */
export const fanoutStarted = (loopKey: string, body: OptionalLoopBody, list: LoopList, concurrency: number): FanoutMove => {
    if (body === null || list.items.length === 0) return { kind: "summed", output: loopSummaryOf(list, []) }
    const frame: ThreadLoopFrame = {
        nodeKey: loopKey,
        index: 0,
        items: [...list.items],
        keys: [...list.keys],
        collect: list.collect,
        held: list.held,
        joins: [],
        picked: null,
        ended: null,
        concurrency,
        gated: false,
    }
    return windowSent(frame, body, 0)
}

/** One item of the window a visit reads: its place, its identity and its record. */
interface WindowItem {
    readonly index: number
    readonly key: string
    readonly record: OptionalLoopItemRecord
}

/**
 * What the loop node of a fan-out does on a visit, from the records of its window (`state.branches`). The cap holds because the loop
 * node is the ONLY node that sends, and it sends a window only once every item of the one before has ended: at most `concurrency`
 * branches exist at any moment. It reads only the checkpoint, so a restart finds the same window and the same records:
 * - an item that runs: wait (its own join visits again);
 * - an item with no record (its window was never written: impossible once the loop sent it, but a visit never trusts it): sent again
 *   from the body's start;
 * - held items and the frame not yet `gated`: the gate, once for all of them; `gated` (the founder's decision came back): each held
 *   item is sent back to the node it stopped at (its earlier nodes reuse their recorded outputs, its calls answer from the ledger);
 * - every item ended: joined (in list order, never completion order), then the next window, or the output after the last.
 */
export const fanoutVisitOf = (
    body: OptionalLoopBody,
    frame: ThreadLoopFrame,
    branches: Readonly<Record<string, unknown>>,
): FanoutMove => {
    const concurrency = frame.concurrency ?? 1
    const window = windowOf(frame.items.length, frame.index, concurrency).map(
        (index): WindowItem => ({
            index,
            key: keyAtOf(frame, index),
            record: itemRecordOf(branches[itemBranchIdOf(frame.nodeKey, keyAtOf(frame, index))]),
        }),
    )
    if (window.some((one) => one.record?.state === "running")) return { kind: "wait" }
    const unsent = window.filter((one) => one.record === null)
    if (body !== null && unsent.length > 0) return sentTo(frame, unsent.map((one) => ({ node: body, index: one.index })))
    const held = window.flatMap((one): ReadonlyArray<LoopHeldItem> =>
        one.record?.state === "held"
            ? [{ index: one.index, key: one.key, nodeKey: one.record.nodeKey, stepKey: one.record.stepKey, trouble: one.record.trouble }]
            : [],
    )
    if (held.length > 0 && frame.gated !== true) return { kind: "gate", frame: { ...frame, gated: true }, held }
    if (held.length > 0) return sentTo({ ...frame, gated: false }, held.map((one) => ({ node: one.nodeKey, index: one.index })))
    const ended = window.flatMap((one): ReadonlyArray<ThreadLoopJoin> =>
        one.record?.state === "ended" ? [{ index: one.index, key: one.key, output: one.record.output }] : [],
    )
    const done = new Set(ended.map((join) => join.index))
    const joins = [...frame.joins.filter((join) => !done.has(join.index)), ...ended].toSorted((left, right) => left.index - right.index)
    const next = frame.index + concurrency
    if (body === null || next >= frame.items.length) return { kind: "summed", output: loopSummaryOf(frame, joins) }
    const sent = windowSent({ ...frame, joins }, body, next)
    if (sent.kind !== "fan") return sent
    const joined = Object.fromEntries(
        ended.map((join) => [itemBranchIdOf(frame.nodeKey, join.key), { state: "joined" } satisfies LoopItemRecord]),
    )
    return { ...sent, records: { ...joined, ...sent.records } }
}

/**
 * The output a branch gathers for its item when it leaves the body on the step `stepKey`: the `collect` node's output of THIS item
 * (`<loop>[<item>].<collect>` among the branch's steps; null when the item's route never reached it), or, for a loop with no
 * `collect`, the output of the step it left on (null for a node passed over).
 */
export const branchGatheredOf = (
    frame: Pick<ThreadLoopFrame, "collect">,
    branch: LoopBranch,
    steps: Readonly<Record<string, unknown>>,
    stepKey: string,
): LoopItem => {
    const step = steps[frame.collect === null ? stepKey : iterationKeyOf(branch.loop, branch.key, frame.collect)]
    return isRecord(step) && step.output !== undefined ? (step.output as LoopItem) : null
}
