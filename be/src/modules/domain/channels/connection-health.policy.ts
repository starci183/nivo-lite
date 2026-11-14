import type { HealthCandidate } from "@modules/domain/connections"
import type { HealthVerdict } from "./channels.contracts"

/** Providers that send us events, so silence from them means something. */
const RECEIVES_EVENTS: ReadonlySet<string> = new Set(["telegram", "zalo_oa", "sepay", "payos", "casso"])

const HOUR_MS = 3_600_000

/** A connection that reports an error (a refused credential among them) is failing, one the scheduler marked degraded stays degraded; one that should receive events and heard none for too long is silent; the rest are fine. */
export const judgeConnection = (
    connection: HealthCandidate,
    nowMs: number,
    silentAfterHours: number,
): HealthVerdict => {
    // A refused credential stays a reconnect request while the status says error; once the owner connected again (the status cleared) it is fine.
    if (connection.health === "needs_reauth" && connection.status === "error") {
        return { state: "needs_reauth", reason: connection.lastError.slice(0, 200) || "the provider refused the credential" }
    }
    if (connection.status === "error") {
        return { state: "failing", reason: connection.lastError.slice(0, 200) || "connection reports an error" }
    }
    // The poll scheduler owns this mark (it sets it when the breaker opens for a reason that is not a refused credential, and clears it when a poll ends well).
    if (connection.health === "degraded") return { state: "degraded", reason: "the provider cannot be read at the moment" }
    if (RECEIVES_EVENTS.has(connection.provider)) {
        const last = Date.parse(connection.lastEventAt === "" ? connection.createdAt : connection.lastEventAt)
        const hours = (nowMs - last) / HOUR_MS
        if (hours > silentAfterHours) return { state: "silent", reason: `no event for ${Math.floor(hours)}h` }
    }
    return { state: "ok", reason: "" }
}
