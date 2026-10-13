import { DEFAULT_REPLY_TIMEOUT_SEC, isFresh, processorFromSettings, replyTimeoutSec } from "./engine-status.policy"

describe("engine status policy", () => {
    it("runs on OpenClaw unless the operator set the direct model", () => {
        expect(processorFromSettings({ processor: "nivo" })).toBe("nivo")
        expect(processorFromSettings({ processor: "openclaw" })).toBe("openclaw")
        expect(processorFromSettings({})).toBe("openclaw")
        expect(processorFromSettings(null)).toBe("openclaw")
        expect(processorFromSettings(undefined)).toBe("openclaw")
    })

    it("accepts a reply timeout from 5 to 120 seconds, rounded, and defaults the rest", () => {
        expect(replyTimeoutSec({ openclawTimeoutSec: 30.4 })).toBe(30)
        expect(replyTimeoutSec({ openclawTimeoutSec: 4 })).toBe(DEFAULT_REPLY_TIMEOUT_SEC)
        expect(replyTimeoutSec({ openclawTimeoutSec: 121 })).toBe(DEFAULT_REPLY_TIMEOUT_SEC)
        expect(replyTimeoutSec({ openclawTimeoutSec: "soon" })).toBe(DEFAULT_REPLY_TIMEOUT_SEC)
        expect(replyTimeoutSec(null)).toBe(DEFAULT_REPLY_TIMEOUT_SEC)
        expect(replyTimeoutSec(undefined)).toBe(DEFAULT_REPLY_TIMEOUT_SEC)
    })

    it("calls an instant fresh only inside the window", () => {
        const now = Date.parse("2026-10-12T10:00:00.000Z")

        expect(isFresh("2026-10-12T09:59:00.000Z", now, 120_000)).toBe(true)
        expect(isFresh("2026-10-12T09:00:00.000Z", now, 120_000)).toBe(false)
        expect(isFresh(null, now, 120_000)).toBe(false)
    })
})
