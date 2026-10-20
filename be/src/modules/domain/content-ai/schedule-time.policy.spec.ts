import { Test } from "@nestjs/testing"
import * as subject from "./schedule-time.policy"

const { publishMomentOf } = subject

const NOW = new Date("2026-10-20T07:00:00.000Z")

describe("publishMomentOf", () => {
    it("keeps a requested moment at least fifteen minutes ahead", () => {
        expect(publishMomentOf(NOW, "2026-10-24T02:00:00.000Z").toISOString()).toBe("2026-10-24T02:00:00.000Z")
    })

    it("falls back to tomorrow 09:00 Vietnam time for none, a past or a too-near moment and garbage", () => {
        const tomorrowNine = "2026-10-21T02:00:00.000Z"
        expect(publishMomentOf(NOW, null).toISOString()).toBe(tomorrowNine)
        expect(publishMomentOf(NOW, "2026-10-20T07:05:00.000Z").toISOString()).toBe(tomorrowNine)
        expect(publishMomentOf(NOW, "soon").toISOString()).toBe(tomorrowNine)
    })

    it("counts tomorrow in Vietnam time late in the UTC day", () => {
        expect(publishMomentOf(new Date("2026-10-20T18:00:00.000Z"), null).toISOString()).toBe(
            "2026-10-22T02:00:00.000Z",
        )
    })
})

const SUBJECT = Symbol("schedule-time.policy")
const POLICY = { publishMomentOf }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: POLICY }],
    }).compile()
    return moduleRef.get<typeof import("./schedule-time.policy")>(SUBJECT)
}

describe("schedule-time policy module", () => {
    it("is provided to Nest as a value", async () => {
        const built = await buildSubject()

        expect(built.publishMomentOf).toBe(publishMomentOf)
    })
})
