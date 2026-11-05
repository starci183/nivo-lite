import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { ORDER_WAITING, sampleState, SAMPLE_NOW } from "../fixtures/sales.data"
import { memoryProvider } from "../memory"
import type { MemoryState } from "../memory"
import { decideAction } from "./decide.action"

const OWNER = "owner-1"

const decide = (state: MemoryState, raw: unknown, memberId: string | null = OWNER): Promise<ActionResult> => {
    const context: RunContext = { workspaceId: "w1", memberId, now: new Date(SAMPLE_NOW) }
    return (
        decideAction.execute?.(memoryProvider(state), raw, context) ??
        Promise.resolve({ ok: false, reason: "failed", message: { key: "not_run" } })
    )
}

const statusOf = (state: MemoryState): string | undefined =>
    state.orders.find((order) => order.id === ORDER_WAITING.id)?.status

describe("sales.decide", () => {
    it("confirms the order when the owner approves", async () => {
        const state = sampleState([OWNER])
        expect(await decide(state, { id: ORDER_WAITING.id, command: "approve" })).toEqual({
            ok: true,
            data: { changed: true },
        })
        expect(statusOf(state)).toBe("confirmed")
    })

    it("cancels the order when the owner rejects", async () => {
        const state = sampleState([OWNER])
        expect(await decide(state, { id: ORDER_WAITING.id, command: "reject" })).toEqual({ ok: true })
        expect(statusOf(state)).toBe("cancelled")
    })

    it("leaves the order waiting when a member without the owner's right approves", async () => {
        const state = sampleState([])
        expect(await decide(state, { id: ORDER_WAITING.id, command: "approve" }, "staff-1")).toMatchObject({
            ok: false,
        })
        expect(statusOf(state)).toBe("draft")
    })

    it("refuses a command it does not know and asks the owner's right", async () => {
        expect(await decide(sampleState([OWNER]), { id: ORDER_WAITING.id, command: "edit" })).toMatchObject({
            ok: false,
            reason: "invalid",
        })
        expect(decideAction.permission).toBe("sales.approve")
    })
})
