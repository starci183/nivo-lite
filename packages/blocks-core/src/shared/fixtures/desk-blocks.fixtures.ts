import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { agentFlowsBlock } from "../blocks/agent-flows.block"
import type { dataSetsBlock } from "../blocks/data-sets.block"
import type { reachCardBlock } from "../blocks/reach-card.block"
import {
    DESK_FLOWS_VIEW,
    DESK_REACH_VIEW,
} from "../platform/fixtures/agent-desk.fixtures"
import type { DeskFlowsCard, ReachCard } from "../rows/desk-views"

/*
 * The generic desk blocks in every state a story or a spec draws: ready, empty, loading, failed, forbidden. The data is the platform
 * fixtures' (the flows: a real installed template's graph), never a drawing of its own.
 */

/** Every status one read slot of a desk block can be in. */
export interface DeskSlotStates<T> {
    /** Settled with data. */
    readonly ready: DataSlot<T>
    /** Settled with nothing. */
    readonly empty: DataSlot<T>
    /** The first read is in flight. */
    readonly loading: DataSlot<T>
    /** The read failed. */
    readonly error: DataSlot<T>
    /** The viewer may not see it. */
    readonly forbidden: DataSlot<T>
}

/** The props of the flows card as the desk template gives them. */
export const agentFlowsFixtureProps: z.infer<(typeof agentFlowsBlock)["props"]> = {
    label: { vi: "N\u00f3 l\u00e0m vi\u1ec7c th\u1ebf n\u00e0o", en: "How it works" },
    empty: { vi: "Ch\u01b0a c\u00f3 workflow n\u00e0o \u0111ang b\u1eadt", en: "No workflow is on yet" },
    fact: { vi: "{workflows} workflow, {steps} b\u01b0\u1edbc", en: "{workflows} workflows, {steps} steps" },
    flowPath: "./workflows/{key}/map",
}

/** The flows card in every state. */
export const agentFlowsFixtures: DeskSlotStates<DeskFlowsCard> = {
    ready: { items: DESK_FLOWS_VIEW },
    empty: { isEmpty: true },
    loading: { isLoading: true },
    error: { isError: true },
    forbidden: { isForbidden: true },
}

/** The props of the reach card as the desk template gives them. */
export const reachCardFixtureProps: z.infer<(typeof reachCardBlock)["props"]> = {
    label: { vi: "N\u00f3 \u0111\u01b0\u1ee3c ch\u1ea1m v\u00e0o g\u00ec", en: "What it may touch" },
    empty: { vi: "Ch\u01b0a g\u1eafn t\u00e0i kho\u1ea3n n\u00e0o", en: "No account attached yet" },
    linkLabel: { vi: "Quy\u1ec1n", en: "Rights" },
    linkPath: "./connections",
    modes: {
        auto: { vi: "T\u1ef1 l\u00e0m", en: "Does itself" },
        ask: { vi: "H\u1ecfi tr\u01b0\u1edbc", en: "Asks first" },
        none: { vi: "Kh\u00f4ng l\u00e0m", en: "Never does" },
    },
    states: {
        connected: { vi: "\u0110\u00e3 k\u1ebft n\u1ed1i", en: "Connected" },
        attention: { vi: "C\u1ea7n xem l\u1ea1i", en: "Needs attention" },
        off: { vi: "Ch\u01b0a d\u00f9ng", en: "Not used" },
    },
}

/** The reach card in every state. */
export const reachCardFixtures: DeskSlotStates<ReachCard> = {
    ready: { items: DESK_REACH_VIEW },
    empty: { isEmpty: true },
    loading: { isLoading: true },
    error: { isError: true },
    forbidden: { isForbidden: true },
}

/** The props of a data sets card with one counted set and one set no read counts. */
export const dataSetsFixtureProps: z.infer<(typeof dataSetsBlock)["props"]> = {
    label: { vi: "D\u1eef li\u1ec7u n\u00f3 \u0111ang l\u00e0m vi\u1ec7c tr\u00ean", en: "The data it works on" },
    openLabel: { vi: "M\u1edf", en: "Open" },
    items: [
        { set: "payables", label: { vi: "Ph\u1ea3i tr\u1ea3", en: "Payables" }, countPath: "payables" },
        { set: "tickets", label: { vi: "Phi\u1ebfu h\u1ed7 tr\u1ee3", en: "Tickets" } },
    ],
}

/** The counts record of the data sets card in every state: the rows draw in each, the counts only when ready. */
export const dataSetsFixtures: DeskSlotStates<unknown> = {
    ready: { items: { payables: 12 } },
    empty: { isEmpty: true },
    loading: { isLoading: true },
    error: { isError: true },
    forbidden: { isForbidden: true },
}
