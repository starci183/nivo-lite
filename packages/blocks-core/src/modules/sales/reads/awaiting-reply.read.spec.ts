import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { LEAD_NEW, LEAD_WON, SAMPLE_NOW, sampleState } from "../fixtures/sales.data"
import { memoryProvider } from "../memory"
import { awaitingReplyRead } from "./awaiting-reply.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date(SAMPLE_NOW) }

describe("sales.awaiting-reply", () => {
    it("lists the open customers who wait, longest wait first, and leaves out closed deals", async () => {
        const state = sampleState([])
        state.leads.push({ ...LEAD_NEW, id: "lead-8", contactName: "Early", awaitingSince: "2026-11-05T06:00:00.000Z" })
        state.leads.push({ ...LEAD_WON, id: "lead-9", awaitingSince: "2026-11-05T05:00:00.000Z" })
        const result = await awaitingReplyRead.execute?.(memoryProvider(state), {}, CONTEXT)
        expect(result).toMatchObject({
            ok: true,
            data: {
                rows: [
                    { id: "lead-8", title: "Early", reason: "awaiting_reply", at: "2026-11-05T06:00:00.000Z" },
                    { id: "lead-1", reason: "awaiting_reply", at: "2026-11-05T07:00:00.000Z" },
                ],
                cursor: null,
            },
        })
    })

    it("is read with the view permission", () => {
        expect(awaitingReplyRead.permission).toBe("sales.view")
    })
})
