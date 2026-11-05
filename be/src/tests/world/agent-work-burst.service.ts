import { readFileSync } from "node:fs"
import { burstOf, graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { EntityManager } from "typeorm"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

/** The window and the longest wait a flow asks for a channel's burst of messages. */
export interface FlowBurst {
    readonly windowMs: number
    readonly maxWaitMs: number
}

/** The burst the flow file asks for its channel trigger; a file that cannot be read or asks for none is a missing row of the proof. */
export const flowBurstOf = (path: string): FlowBurst => {
    try {
        const asked = burstOf(graphSpecSchema.parse(JSON.parse(readFileSync(path, "utf8"))).trigger, "channel")
        if (asked !== null && asked.maxWaitMs !== null) return { windowMs: asked.windowMs, maxWaitMs: asked.maxWaitMs }
    } catch (cause) {
        throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, cause })
    }
    throw new TestWorldError({ code: TestWorldErrorCode.RowMissing })
}

/** Stamps a wake with the burst window and longest wait the wake door would have resolved for it. */
export const stampBurst = async (manager: EntityManager, wakeId: string, burst: FlowBurst): Promise<void> => {
    await manager.query("UPDATE public.agent_wakes SET burst_window_ms = $2, burst_max_ms = $3 WHERE id = $1", [
        wakeId,
        burst.windowMs,
        burst.maxWaitMs,
    ])
}

/** Moves the creation of a wake `ms` into the past, as if its message had arrived that much earlier. */
export const ageWake = async (manager: EntityManager, wakeId: string, ms: number): Promise<void> => {
    await manager.query(
        "UPDATE public.agent_wakes SET created_at = created_at - make_interval(secs => $2::numeric / 1000) WHERE id = $1",
        [wakeId, ms],
    )
}
