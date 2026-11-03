import { zaloEventNameOf } from "./zalo-event-name.policy"

describe("zaloEventNameOf", () => {
    it("reads the event name of a body, from bytes or text", () => {
        expect(zaloEventNameOf(Buffer.from(JSON.stringify({ event_name: "user_send_image" })))).toBe("user_send_image")
        expect(zaloEventNameOf(JSON.stringify({ event_name: "follow" }))).toBe("follow")
    })

    it("answers null for a body that is not JSON, an object without a name, or a name that is not shaped like one", () => {
        expect(zaloEventNameOf(undefined)).toBeNull()
        expect(zaloEventNameOf("not json")).toBeNull()
        expect(zaloEventNameOf("42")).toBeNull()
        expect(zaloEventNameOf("null")).toBeNull()
        expect(zaloEventNameOf(JSON.stringify({ app_id: "a" }))).toBeNull()
        expect(zaloEventNameOf(JSON.stringify({ event_name: 5 }))).toBeNull()
        expect(zaloEventNameOf(JSON.stringify({ event_name: "Drop Table; --" }))).toBeNull()
        expect(zaloEventNameOf(JSON.stringify({ event_name: "x".repeat(65) }))).toBeNull()
    })
})
