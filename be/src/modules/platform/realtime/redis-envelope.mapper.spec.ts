import { Test } from "@nestjs/testing"
import { readHubMessage, readStreamEntry } from "./redis-envelope.mapper"

const SUBJECT: unique symbol = Symbol("realtime.redis-envelope.mapper")

const buildSubject = async () => {
    const functions = { readHubMessage, readStreamEntry }
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => functions }],
    }).compile()
    return moduleRef.get<typeof functions>(SUBJECT)
}

const envelope = (fields: object): string => JSON.stringify(fields)

describe("readHubMessage", () => {
    it("reads the message the hub publishes after it retained a frame", async () => {
        const subject = await buildSubject()
        const message = envelope({ topic: "t:1", position: "1-0", frame: JSON.stringify({ id: "e-1", value: 1 }) })

        expect(subject.readHubMessage(message)).toEqual({
            topic: "t:1",
            position: "1-0",
            frame: { id: "e-1", value: 1 },
        })
    })

    it.each([
        ["text that is not JSON", "not json"],
        ["a JSON value that is not an object", "[1]"],
        ["a JSON null", "null"],
        ["an object without a frame", envelope({ topic: "t", position: "" })],
        ["a topic over the bound", envelope({ topic: "t".repeat(257), position: "", frame: "{}" })],
        ["a frame that is not JSON", envelope({ topic: "t", position: "", frame: "nope" })],
        ["a frame that is not an object", envelope({ topic: "t", position: "", frame: "5" })],
        ["a frame that is null", envelope({ topic: "t", position: "", frame: "null" })],
    ])("ignores %s", async (_case, message) => {
        const subject = await buildSubject()

        expect(subject.readHubMessage(message)).toBeUndefined()
    })
})

describe("readStreamEntry", () => {
    it("reads a retained entry: the frame id a client resumes after and the frame", async () => {
        const subject = await buildSubject()
        const raw = ["1-0", ["id", "e-1", "data", JSON.stringify({ id: "e-1", value: 1 })]] as const

        expect(subject.readStreamEntry("t:1", raw)).toEqual({
            id: "e-1",
            entry: { topic: "t:1", position: "1-0", frame: { id: "e-1", value: 1 } },
        })
    })

    it.each([
        ["an entry without the fields the hub writes", ["1-0", ["other", "x"]] as const],
        ["an entry whose data is not JSON", ["1-0", ["id", "e-1", "data", "nope"]] as const],
        ["an entry whose data is not an object", ["1-0", ["id", "e-1", "data", "7"]] as const],
        ["an entry with an odd field list", ["1-0", ["id", "e-1", "data"]] as const],
    ])("ignores %s", async (_case, raw) => {
        const subject = await buildSubject()

        expect(subject.readStreamEntry("t:1", raw)).toBeUndefined()
    })
})
