import type { HealthCandidate } from "@modules/domain/connections"
import type { HealthVerdict } from "./channels.contracts"

/** Providers that send us events, so silence from them means something. */
const RECEIVES_EVENTS: ReadonlySet<string> = new Set(["telegram", "zalo_oa", "sepay", "payos", "casso"])

const HOUR_MS = 3_600_000

/** A connection that reports an error is failing; one that should receive events and heard none for too long is silent; the rest are fine. */
export const judgeConnection = (connection: HealthCandidate, nowMs: number, silentAfterHours: number): HealthVerdict => {
    if (connection.status === "error") {
        return { state: "failing", reason: connection.lastError.slice(0, 200) || "connection reports an error" }
    }
    if (RECEIVES_EVENTS.has(connection.provider)) {
        const last = Date.parse(connection.lastEventAt === "" ? connection.createdAt : connection.lastEventAt)
        const hours = (nowMs - last) / HOUR_MS
        if (hours > silentAfterHours) return { state: "silent", reason: `no event for ${Math.floor(hours)}h` }
    }
    return { state: "ok", reason: "" }
}
