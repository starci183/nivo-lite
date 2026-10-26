import type { AgentKnowledgeLensType } from "@/modules/api"

/** The kinds of shared knowledge a view can read, in the order the matrix lists them. */
export const LENS_LANES = [
    "documentPublic",
    "documentInternal",
    "factPublic",
    "factInternal",
    "factRestricted",
] as const

/** One kind of shared knowledge: a document or a fact, by who may read it. */
export type LensLane = (typeof LENS_LANES)[number]

/** What one view reads of one kind of knowledge: whether it may, and how many items that is (nothing for the customer). */
export interface LensCell {
    readonly lane: LensLane
    readonly isOpen: boolean
    readonly count: number | null
}

/** One view of the shared knowledge: the customer's, or the one of an installed agent. */
export interface AgentLens {
    /** Stable across reads: the agent itself, or `customer`. */
    readonly id: string
    readonly kind: "customer" | "agent"
    /** The human name of the agent; null for the customer. */
    readonly name: string | null
    readonly avatarUrl: string | null
    readonly module: string | null
    readonly installationId: string | null
    readonly audience: "customer" | "internal"
    readonly cells: ReadonlyArray<LensCell>
}

/** The lane a wire word stands for, or null for a word this app does not know. */
const laneOf = (value: string): LensLane | null => LENS_LANES.find((lane) => lane === value) ?? null

/** The view an `agentKnowledgeLenses` row stands for; the cells follow the order of the matrix. */
export const toAgentLens = (row: AgentKnowledgeLensType): AgentLens => ({
    id: row.agentId ?? "customer",
    kind: row.kind === "agent" ? "agent" : "customer",
    name: row.name,
    avatarUrl: row.avatarUrl,
    module: row.module,
    installationId: row.installationId,
    audience: row.audience === "internal" ? "internal" : "customer",
    cells: LENS_LANES.map((lane) => {
        const cell = row.lanes.find((one) => laneOf(one.lane) === lane)
        return { lane, isOpen: cell?.open ?? false, count: cell?.count ?? null }
    }),
})
