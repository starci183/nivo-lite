import { Test } from "@nestjs/testing"
import { chatStampOf, sentAtOf } from "./message-stamp.policy"

/** The members of the subject under test. */
interface Subject {
    readonly chatStampOf: typeof chatStampOf
    readonly sentAtOf: typeof sentAtOf
}

const SUBJECT = Symbol("message-stamp.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { chatStampOf, sentAtOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NOW = Date.parse("2026-11-06T03:00:00.000Z")

describe("chatStampOf", () => {
    it("keeps the channel time and tells messages of one millisecond apart by the id of the message", async () => {
        const policy = await build()
        const sentAt = Date.parse("2026-11-06T02:00:00.123Z")
        const a = policy.chatStampOf(sentAt, NOW, "tg:1:1")
        const b = policy.chatStampOf(sentAt, NOW, "tg:1:2")
        expect(a.at.toISOString()).toBe("2026-11-06T02:00:00.123Z")
        expect(a).toEqual(policy.chatStampOf(sentAt, NOW, "tg:1:1"))
        expect(a.tieMicros).not.toBe(b.tieMicros)
        expect(a.tieMicros).toBeLessThan(1000)
    })

    it("never puts a message in the future", async () => {
        const policy = await build()
        expect(policy.chatStampOf(NOW + 60_000, NOW, "x").at.getTime()).toBe(NOW)
    })
})

describe("sentAtOf", () => {
    it("writes the stored time when the channel gave none and the stamp time with its microsecond tail otherwise", async () => {
        const policy = await build()
        const now = new Date(NOW)
        expect(policy.sentAtOf(null, now)).toBe("2026-11-06T03:00:00.000Z")
        expect(policy.sentAtOf({ at: new Date("2026-11-06T02:00:00.123Z"), tieMicros: 7 }, now)).toBe(
            "2026-11-06T02:00:00.123007Z",
        )
    })
})
