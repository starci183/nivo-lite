import { Test } from "@nestjs/testing"
import { DEFAULT_REPLY_TIMEOUT_SEC, isFresh, processorFromSettings, replyTimeoutSec } from "./engine-status.policy"

type Subject = {
    processorFromSettings: typeof processorFromSettings
    replyTimeoutSec: typeof replyTimeoutSec
    isFresh: typeof isFresh
}

const SUBJECT = Symbol("engine-status.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { processorFromSettings, replyTimeoutSec, isFresh } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("engine status policy", () => {
    it("runs on OpenClaw unless the operator set the direct model", async () => {
        const subject = await buildSubject()

        expect(subject.processorFromSettings({ processor: "nivo" })).toBe("nivo")
        expect(subject.processorFromSettings({ processor: "openclaw" })).toBe("openclaw")
        expect(subject.processorFromSettings({})).toBe("openclaw")
        expect(subject.processorFromSettings(null)).toBe("openclaw")
        expect(subject.processorFromSettings(undefined)).toBe("openclaw")
    })

    it("accepts a reply timeout from 5 to 120 seconds, rounded, and defaults the rest", async () => {
        const subject = await buildSubject()

        expect(subject.replyTimeoutSec({ openclawTimeoutSec: 30.4 })).toBe(30)
        expect(subject.replyTimeoutSec({ openclawTimeoutSec: 4 })).toBe(DEFAULT_REPLY_TIMEOUT_SEC)
        expect(subject.replyTimeoutSec({ openclawTimeoutSec: 121 })).toBe(DEFAULT_REPLY_TIMEOUT_SEC)
        expect(subject.replyTimeoutSec({ openclawTimeoutSec: "soon" })).toBe(DEFAULT_REPLY_TIMEOUT_SEC)
        expect(subject.replyTimeoutSec(null)).toBe(DEFAULT_REPLY_TIMEOUT_SEC)
        expect(subject.replyTimeoutSec(undefined)).toBe(DEFAULT_REPLY_TIMEOUT_SEC)
    })

    it("calls an instant fresh only inside the window", async () => {
        const subject = await buildSubject()

        const now = Date.parse("2026-10-12T10:00:00.000Z")

        expect(subject.isFresh("2026-10-12T09:59:00.000Z", now, 120_000)).toBe(true)
        expect(subject.isFresh("2026-10-12T09:00:00.000Z", now, 120_000)).toBe(false)
        expect(subject.isFresh(null, now, 120_000)).toBe(false)
    })
})
