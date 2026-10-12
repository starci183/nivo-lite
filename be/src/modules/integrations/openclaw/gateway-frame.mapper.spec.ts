import { Secret } from "@modules/platform/config"
import { connectParams, looksFinal, parseFrame, PROTOCOL_VERSION, readSessionMessage } from "./gateway-frame.mapper"

describe("gateway frame mapper", () => {
    describe("parseFrame", () => {
        it("reads an event", () => {
            expect(parseFrame('{"type":"event","event":"agent","payload":{"status":"ok"}}')).toEqual({
                type: "event",
                event: "agent",
                payload: { status: "ok" },
            })
        })

        it("reads a response with a string id and its error body", () => {
            expect(
                parseFrame(
                    JSON.stringify({
                        type: "res",
                        id: "7",
                        ok: false,
                        error: { code: "UNAVAILABLE", message: "starting", details: { retryAfterMs: 2500 } },
                    }),
                ),
            ).toEqual({
                type: "res",
                id: "7",
                ok: false,
                payload: undefined,
                error: { code: "UNAVAILABLE", message: "starting", retryAfterMs: 2500 },
            })
        })

        it("reads a response with a numeric id, defaults an unnamed error and ignores a non-numeric retry hint", () => {
            expect(parseFrame('{"type":"res","id":3,"ok":true,"payload":{"a":1}}')).toEqual({
                type: "res",
                id: "3",
                ok: true,
                payload: { a: 1 },
                error: null,
            })
            expect(parseFrame('{"type":"res","id":"4","error":{"details":{"retryAfterMs":"soon"}}}')).toEqual({
                type: "res",
                id: "4",
                ok: false,
                payload: undefined,
                error: { code: "UNKNOWN", message: "", retryAfterMs: null },
            })
            expect(parseFrame('{"type":"res","id":"5","error":{"code":"X","message":"m"}}')).toMatchObject({
                error: { code: "X", message: "m", retryAfterMs: null },
            })
        })

        it("refuses text that is not a frame", () => {
            expect(parseFrame("not json")).toBeNull()
            expect(parseFrame("[1]")).toBeNull()
            expect(parseFrame("null")).toBeNull()
            expect(parseFrame('{"type":"event"}')).toBeNull()
            expect(parseFrame('{"type":"res","id":true}')).toBeNull()
            expect(parseFrame('{"type":"other"}')).toBeNull()
        })
    })

    describe("connectParams", () => {
        it("puts a token in the first frame", () => {
            expect(connectParams({ kind: "token", token: new Secret("t0") }, "linux")).toEqual({
                minProtocol: PROTOCOL_VERSION,
                maxProtocol: PROTOCOL_VERSION,
                client: { id: "cli", version: "1.0.0", platform: "linux", mode: "cli" },
                auth: { token: "t0" },
                role: "operator",
                scopes: ["operator.read", "operator.write"],
            })
        })

        it("puts a password in the first frame", () => {
            expect(connectParams({ kind: "password", password: new Secret("pw") }, "win32")).toMatchObject({
                auth: { password: "pw" },
            })
        })
    })

    describe("readSessionMessage", () => {
        it("narrows an assistant message with usage and a provider-qualified model", () => {
            expect(
                readSessionMessage({
                    sessionKey: "agent:a:c",
                    message: {
                        role: "assistant",
                        stopReason: "stop",
                        provider: "p",
                        model: "m",
                        content: [{ text: "Hello" }, "there"],
                        usage: { input: 10, output: 5, cacheRead: 2, cacheWrite: 1, cost: { total: 0.5 } },
                    },
                }),
            ).toEqual({
                sessionKey: "agent:a:c",
                role: "assistant",
                fromOwner: false,
                text: "Hello\nthere",
                stopReason: "stop",
                usage: { input: 10, output: 5, cacheRead: 2, cacheWrite: 1, cost: 0.5, model: "p/m" },
            })
        })

        it("reads a plain string message under the `key` alias and flags the owner", () => {
            expect(readSessionMessage({ key: "k", senderIsOwner: true, message: "  hi  " })).toEqual({
                sessionKey: "k",
                role: null,
                fromOwner: true,
                text: "hi",
                stopReason: null,
                usage: null,
            })
        })

        it("falls back across text keys and tolerates a model without provider, bad numbers and a missing cost", () => {
            const read = readSessionMessage({
                message: { body: "from body", model: "solo", usage: { input: -1, output: "x", cacheRead: 4 } },
            })
            expect(read.text).toBe("from body")
            expect(read.usage).toEqual({ input: 0, output: 0, cacheRead: 4, cacheWrite: 0, cost: 0, model: "solo" })
            expect(readSessionMessage({ message: { content: { text: "nested" }, usage: { cost: {} } } })).toMatchObject(
                {
                    text: "nested",
                    usage: { cost: 0, model: null },
                },
            )
        })

        it("answers an empty message for anything that carries no text", () => {
            const empty = { sessionKey: null, role: null, fromOwner: false, text: null, stopReason: null, usage: null }
            expect(readSessionMessage(null)).toEqual(empty)
            expect(readSessionMessage([])).toEqual(empty)
            expect(readSessionMessage({ message: "   " })).toEqual(empty)
            expect(readSessionMessage({ message: [] })).toEqual(empty)
            expect(readSessionMessage({ message: 5 })).toEqual(empty)
            expect(readSessionMessage({ message: { other: 1 } })).toEqual(empty)
            expect(readSessionMessage({ message: { usage: "x" } })).toEqual(empty)
        })
    })

    describe("looksFinal", () => {
        it("recognises the contract answer only", () => {
            expect(looksFinal('{"reply": "ok"}')).toBe(true)
            expect(looksFinal('Sure! {"x": 1, "reply" : "ok"}')).toBe(true)
            expect(looksFinal("working on it")).toBe(false)
        })
    })
})
