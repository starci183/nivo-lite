import type { ConnectionRecord } from "./connections.contracts"

/**
 * What a connection asks of its owner beyond its status: `needs_reauth` (the provider refused the credential: only connecting again fixes it,
 * so the page offers the provider's reconnect action and an agent using the account says so) or `degraded` (connected, yet the provider cannot
 * be read at the moment for a reason that is no refused credential: informative, nothing to fix by hand).
 */
export type ConnectionAttention = "needs_reauth" | "degraded"

/** The attention one connection asks for, or null: the recorded health state, read exactly (a refused credential counts only while the status still says error). */
export const connectionAttentionOf = (
    connection: Pick<ConnectionRecord, "status" | "health">,
): ConnectionAttention | null => {
    if (connection.health === "needs_reauth") return connection.status === "error" ? "needs_reauth" : null
    return connection.health === "degraded" && connection.status !== "disconnected" ? "degraded" : null
}
