import { Test } from "@nestjs/testing"
import { writerOf } from "./realtime-connection.policy"

const SUBJECT: unique symbol = Symbol("realtime.connection.policy")

const buildSubject = async () => {
    const functions = { writerOf }
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => functions }],
    }).compile()
    return moduleRef.get<typeof functions>(SUBJECT)
}

describe("writerOf", () => {
    it("answers the first entity manager, the one that holds the realtime tables", async () => {
        const subject = await buildSubject()
        expect(subject.writerOf(["first", "second"])).toBe("first")
    })

    it("refuses a hub registered with no connection", async () => {
        const subject = await buildSubject()

        expect(() => subject.writerOf([])).toThrow("REALTIME_CONNECTION_MISSING")
    })
})
