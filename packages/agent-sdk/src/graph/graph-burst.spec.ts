import { BURST_MAX_WAIT_MAX_MS, BURST_WINDOW_MAX_MS, burstIsSound, burstOf, parseBurstDuration } from "./graph-burst"
import type { GraphSpecTrigger } from "./graph-spec.types"

describe("parseBurstDuration", () => {
    it("reads milliseconds, seconds and minutes, and nothing else", () => {
        expect(["0s", "1500ms", "6s", "2m"].map(parseBurstDuration)).toEqual([0, 1500, 6000, 120_000])
        expect(["", "6", "6h", "-1s", "1.5s", " 6s", "6 s", "9999999s"].map(parseBurstDuration)).toEqual([
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
        ])
    })
})

describe("burstIsSound", () => {
    it("holds a window and a longest wait inside their bounds, the wait no shorter than the window", () => {
        expect(burstIsSound({ window: "0s" })).toBe(true)
        expect(burstIsSound({ window: "6s", maxWait: "6s" })).toBe(true)
        expect(
            burstIsSound({ window: `${String(BURST_WINDOW_MAX_MS)}ms`, maxWait: `${String(BURST_MAX_WAIT_MAX_MS)}ms` }),
        ).toBe(true)
        expect(burstIsSound({ window: "61s" })).toBe(false)
        expect(burstIsSound({ window: "6s", maxWait: "121s" })).toBe(false)
        expect(burstIsSound({ window: "6s", maxWait: "5s" })).toBe(false)
        expect(burstIsSound({ window: "6s", maxWait: "x" })).toBe(false)
        expect(burstIsSound({ window: "x" })).toBe(false)
    })
})

describe("burstOf", () => {
    const trigger: GraphSpecTrigger = {
        kind: "tag",
        sources: ["channel", "agent", "schedule"],
        burst: {
            channel: { window: "6s", maxWait: "20s" },
            agent: { window: "0s" },
            schedule: { window: "soon" },
            "chats-group": { window: "61s" },
        },
    }

    it("answers the setting of a source in milliseconds, the longest wait left open when the flow names none", () => {
        expect(burstOf(trigger, "channel")).toEqual({ windowMs: 6000, maxWaitMs: 20_000 })
        expect(burstOf(trigger, "agent")).toEqual({ windowMs: 0, maxWaitMs: null })
    })

    it("answers nothing for a source the flow does not set, or sets unsoundly", () => {
        expect(burstOf(trigger, "system-event")).toBeNull()
        expect(burstOf(trigger, "schedule")).toBeNull()
        expect(burstOf(trigger, "chats-group")).toBeNull()
        expect(
            burstOf(
                { kind: "tag", sources: ["channel"], burst: { channel: { window: "6s", maxWait: "5s" } } },
                "channel",
            ),
        ).toBeNull()
        expect(burstOf({ kind: "tag", sources: ["channel"] }, "channel")).toBeNull()
    })
})
