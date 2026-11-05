import type { ActionOutcome } from "@nivo-lite/agent-sdk/block"
import { refusalOf } from "./refusal"

const MESSAGE = { vi: "Khong the", en: "Cannot" }

describe("refusalOf", () => {
    it("gives the message of a refusal and of a conflict", () => {
        expect(refusalOf({ ok: false, reason: "refused", message: MESSAGE })).toEqual(MESSAGE)
        expect(refusalOf({ ok: false, reason: "conflict", message: MESSAGE })).toEqual(MESSAGE)
    })

    it("gives nothing for success, a forbidden run, a failure or invalid fields", () => {
        const outcomes: ReadonlyArray<ActionOutcome> = [
            { ok: true },
            { ok: false, reason: "forbidden", message: MESSAGE },
            { ok: false, reason: "failed", message: MESSAGE },
            { ok: false, reason: "invalid", fields: {}, message: MESSAGE },
        ]
        expect(outcomes.map(refusalOf)).toEqual([null, null, null, null])
    })
})
