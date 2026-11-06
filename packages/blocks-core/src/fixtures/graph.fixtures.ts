import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { graphBlock } from "../blocks/graph.block"
import type { GraphView, RunPath } from "../rows/graph-view"

/** Every status the graph read of a graph block can be in, for the stories and the specs. */
export interface GraphFixtureSlots {
    /** The graph has nodes. */
    readonly ready: DataSlot<GraphView>
    /** The graph has no node. */
    readonly empty: DataSlot<GraphView>
    /** The read failed. */
    readonly error: DataSlot<GraphView>
    /** The first read is in flight. */
    readonly loading: DataSlot<GraphView>
    /** The viewer may not see the graph. */
    readonly forbidden: DataSlot<GraphView>
}

/** The path read of the runs the graph may highlight, for the stories and the specs. */
export interface GraphRunPathFixtures {
    /** A run that stopped at a wait node for an approval. */
    readonly waiting: DataSlot<RunPath>
    /** A run that parked on a failed step. */
    readonly parked: DataSlot<RunPath>
    /** A run that went the other branch and finished. */
    readonly done: DataSlot<RunPath>
}

/** The props of a graph over the sample flow. */
export const graphFixtureProps: z.infer<(typeof graphBlock)["props"]> = {
    label: { vi: "Luong xu ly tin nhan", en: "Message flow" },
    empty: { vi: "Chua co luong nao", en: "No flow yet" },
    selectParam: "node",
    runParam: "run",
}

/** The sample flow: a message arrives, a quote request waits for approval, anything else is answered at once. */
export const GRAPH_FIXTURE: GraphView = {
    nodes: [
        { id: "inbound", label: "Tin nhan den", kind: "trigger", description: "Zalo OA" },
        { id: "intent", label: "Khach hoi gia?", kind: "condition" },
        { id: "quote", label: "Soan bao gia", kind: "step" },
        { id: "approval", label: "Cho duyet bao gia", kind: "wait" },
        { id: "send-quote", label: "Gui bao gia", kind: "step" },
        { id: "reply", label: "Tra loi thuong", kind: "step" },
        { id: "end", label: "Ket thuc", kind: "output" },
    ],
    edges: [
        { id: "e1", from: "inbound", to: "intent" },
        { id: "e2", from: "intent", to: "quote", condition: "hoi gia" },
        { id: "e3", from: "intent", to: "reply", condition: "khac" },
        { id: "e4", from: "quote", to: "approval" },
        { id: "e5", from: "approval", to: "send-quote", condition: "duoc duyet" },
        { id: "e6", from: "send-quote", to: "end" },
        { id: "e7", from: "reply", to: "end" },
    ],
}

/** The sample flow in every status. */
export const graphFixtures: GraphFixtureSlots = {
    ready: { items: GRAPH_FIXTURE },
    empty: { isEmpty: true },
    error: { isError: true },
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
}

/** The runs of the sample flow, as the path read yields them. */
export const graphRunPathFixtures: GraphRunPathFixtures = {
    waiting: {
        items: {
            steps: [
                { node: "inbound", state: "done" },
                { node: "intent", state: "done" },
                { node: "quote", state: "done" },
                { node: "approval", state: "waiting" },
            ],
        },
    },
    parked: {
        items: {
            steps: [
                { node: "inbound", state: "done" },
                { node: "intent", state: "done" },
                { node: "quote", state: "done" },
                { node: "approval", state: "done" },
                { node: "send-quote", state: "parked" },
            ],
        },
    },
    done: {
        items: {
            steps: [
                { node: "inbound", state: "done" },
                { node: "intent", state: "done" },
                { node: "reply", state: "done" },
                { node: "end", state: "done" },
            ],
        },
    },
}
