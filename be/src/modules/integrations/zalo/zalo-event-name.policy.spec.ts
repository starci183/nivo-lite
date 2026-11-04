import { Test } from "@nestjs/testing"
import { zaloEventNameOf } from "./zalo-event-name.policy"

const SUBJECT = Symbol("zalo-event-name.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { zaloEventNameOf } }],
    }).compile()
    return moduleRef.get<typeof import("./zalo-event-name.policy")>(SUBJECT)
}

describe("zaloEventNameOf", () => {
    it("reads the event name of a body, from bytes or text", async () => {
        const subject = await build()
        expect(subject.zaloEventNameOf(Buffer.from(JSON.stringify({ event_name: "user_send_image" })))).toBe(
            "user_send_image",
        )
        expect(subject.zaloEventNameOf(JSON.stringify({ event_name: "follow" }))).toBe("follow")
    })

    it("answers null for a body that is not JSON, an object without a name, or a name that is not shaped like one", async () => {
        const subject = await build()
        expect(subject.zaloEventNameOf(undefined)).toBeNull()
        expect(subject.zaloEventNameOf("not json")).toBeNull()
        expect(subject.zaloEventNameOf("42")).toBeNull()
        expect(subject.zaloEventNameOf("null")).toBeNull()
        expect(subject.zaloEventNameOf(JSON.stringify({ app_id: "a" }))).toBeNull()
        expect(subject.zaloEventNameOf(JSON.stringify({ event_name: 5 }))).toBeNull()
        expect(subject.zaloEventNameOf(JSON.stringify({ event_name: "Not An Event; --" }))).toBeNull()
        expect(subject.zaloEventNameOf(JSON.stringify({ event_name: "x".repeat(65) }))).toBeNull()
    })
})
