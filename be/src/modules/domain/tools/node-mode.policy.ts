import type { NodeStepRef } from "@modules/domain/graph-nodes"
import type { OptionalRightSeen, RightOrigin } from "./right-origin.contracts"

/**
 * How a node's calls run (nivo-frame `rights`): `auto` runs them; `ask` interrupts for a person's approval on a card in /chat, then runs
 * (a person's no is the business answer `declined`). Declared by every node; there is no engine default, no per-tool mode, no class.
 */
export type NodeMode = "auto" | "ask"

/** One provider a node lists, in its order: its display kind, the provider key, and no connection (bound from the agent's attachments). */
export interface NodeRequestAccount {
    /** The display kind of the provider's accounts (`messaging`, `payment`, `books`, `mail`, `records`), or empty when none is known. */
    readonly kind: string
    /** The provider key as nodes name it (`google`, `sepay`, a source key such as `crm`). */
    readonly provider: string
    /** Always null in a template; a stored `@1` node may pin one account. */
    readonly connectionId: string | null
}

/** What the pinned version's node declares: its ONE mode, and the providers it may act through, in priority order. */
export interface NodeRequest {
    /** The node's mode. */
    readonly mode: NodeMode
    /** The providers, in order (empty for a node of NIVO's own tools only). */
    readonly accounts: ReadonlyArray<NodeRequestAccount>
    /**
     * True for a CONTROL step of the engine (its installed definition's `control` flag: the hand-off, the outcome, the list loop): its
     * calls (the hand-off's tag) are the engine's own, which run; its `mode` is then `auto` and its accounts none.
     */
    readonly control?: true | undefined
}

/** The request of a node, or null when it cannot be read (version or node gone) or states no mode: there is no default. */
export type OptionalNodeRequest = NodeRequest | null

/**
 * The ONE reader of what a pinned version's node declares, supplied by the owner of the workflow versions (bound at the app root). The
 * step names the node, the version the run is pinned to and its workflow.
 */
export interface NodeRequestsGate {
    /** The request of the step's node in its pinned version, or null (unreadable, or no mode stated). */
    requestOf(workspaceId: string, agentId: string, step: NodeStepRef): Promise<OptionalNodeRequest>
}

/** True for a stated mode. */
export const isNodeMode = (value: unknown): value is NodeMode => value === "auto" || value === "ask"

/**
 * Where a call's mode comes from:
 * - a workflow STEP: its node's declared mode (`request`; null when the node cannot be read or states none);
 * - `engine`: code the workspace installed (a module's declared job, the engine's own line on a stop, an adapter asking again inside a call
 *   already decided): it runs;
 * - `outside`: a road with no node and no person's approval in hand (an outside client on the MCP endpoint, a screen calling as an agent):
 *   it has no mode, so a WRITE there asks. This is the ONE place a default exists (flagged for the coordinator).
 */
export type ModeSource =
    | { readonly kind: "step"; readonly request: OptionalNodeRequest }
    | { readonly kind: "engine" }
    | { readonly kind: "outside" }

/** What the mode says about one call: run it, ask a person first, or refuse it (the step's node states no mode or cannot be read). */
export type ModeVerdict =
    | { readonly kind: "run" }
    | { readonly kind: "ask"; readonly reason: "ask_mode" | "outside_write" }
    | { readonly kind: "refuse"; readonly reason: "node_mode_unknown" }

/** One call as the mode reads it: whether it writes (a generic fact of its definition), whether a person approved it, and its source. */
export interface ModeCall {
    /** False for a read (`mutates === false`, `scope: "read"`): a read never asks. */
    readonly mutates: boolean
    /** True when the call replays a person's approval of its very fingerprint. */
    readonly approved: boolean
    /** Where its mode comes from. */
    readonly source: ModeSource
}

const RUN: ModeVerdict = { kind: "run" }

/**
 * The verdict of the mode on one call. A read runs. A step's call refuses when its node has no readable mode (the engine has no
 * default: freeze + report), runs on `auto`, and on `ask` runs only once a person approved it. The engine's own calls run. A write of an
 * outside road asks unless a person approved it. Nothing here reads a tool's name, a class, an amount or a record. Pure.
 */
export const modeVerdictOf = (call: ModeCall): ModeVerdict => {
    if (!call.mutates) return RUN
    const { source } = call
    if (source.kind === "engine") return RUN
    if (source.kind === "outside") return call.approved ? RUN : { kind: "ask", reason: "outside_write" }
    if (source.request === null) return { kind: "refuse", reason: "node_mode_unknown" }
    return source.request.mode === "ask" && !call.approved ? { kind: "ask", reason: "ask_mode" } : RUN
}

/** The roads that are the engine's own code: a module's declared job, the engine's line on a stop, an adapter asking again inside a call. */
const ENGINE_ROADS: ReadonlySet<RightOrigin> = new Set<RightOrigin>(["engine_job", "engine_line", "adapter_reask"])

/** The workflow step a call was made in, or null for a call outside every workflow node. */
export const workflowStepOf = (seen: OptionalRightSeen): NodeStepRef | null => {
    const node = seen?.node
    if (node === undefined) return null
    return node.workflowId === null ? null : node
}

/**
 * Where a call's mode comes from, by where it was seen: a workflow step reads its node's request (`read`, called only then); an engine road
 * (or the engine's own caller) is the engine; anything else is outside.
 */
export const modeSourceOf = async (
    seen: OptionalRightSeen,
    engine: boolean,
    read: (step: NodeStepRef) => Promise<OptionalNodeRequest>,
): Promise<ModeSource> => {
    const step = workflowStepOf(seen)
    if (step !== null) {
        const request = await read(step)
        // An engine control step (by its installed definition's flag, never its id) makes the engine's own calls.
        return request?.control === true ? { kind: "engine" } : { kind: "step", request }
    }
    if (engine || (seen !== undefined && ENGINE_ROADS.has(seen.origin))) return { kind: "engine" }
    return { kind: "outside" }
}
