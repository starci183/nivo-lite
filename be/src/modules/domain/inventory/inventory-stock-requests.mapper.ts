import type { AdjustStockOutput, AdjustStockParams } from "./inventory-operations.contracts"

/** The stock adjustment form as GraphQL hands it over: an optional field may arrive as null as well as absent. */
interface AdjustStockForm extends Omit<AdjustStockParams, "locationId" | "delta" | "counted"> {
    /** The location adjusted, when given. */
    readonly locationId?: string | null
    /** The change in quantity, when given. */
    readonly delta?: number | null
    /** The counted quantity, when given. */
    readonly counted?: number | null
}

/** The stock adjustment request of one workspace. */
interface AdjustStockRequest extends AdjustStockParams {
    /** The workspace the adjustment acts in. */
    readonly workspaceId: string
}

/** The adjustment outcome with every optional figure written as null when absent. */
interface AdjustStockFields {
    /** Whether the adjustment was applied or waits for approval. */
    readonly state: "applied" | "waiting"
    /** The quantity before, when applied. */
    readonly before: number | null
    /** The quantity after, when applied. */
    readonly after: number | null
    /** The work item awaiting approval, when waiting. */
    readonly workItemId: string | null
}

/** True when GraphQL handed the field over: neither absent nor null. */
const isGiven = <V>(value: V | null | undefined): value is V => value !== undefined && value !== null

/** Maps the stock adjustment form to the request of the workspace it names; an absent field stays absent. */
export const toAdjustInventoryStockRequest = (workspaceId: string, input: AdjustStockForm): AdjustStockRequest => ({
    workspaceId,
    itemId: input.itemId,
    reason: input.reason,
    ...(isGiven(input.locationId) ? { locationId: input.locationId } : {}),
    ...(isGiven(input.delta) ? { delta: input.delta } : {}),
    ...(isGiven(input.counted) ? { counted: input.counted } : {}),
})

/** Maps the adjustment outcome so every absent figure reads as null. */
export const toAdjustStockType = (result: AdjustStockOutput): AdjustStockFields => ({
    state: result.state,
    before: result.before ?? null,
    after: result.after ?? null,
    workItemId: result.workItemId ?? null,
})
