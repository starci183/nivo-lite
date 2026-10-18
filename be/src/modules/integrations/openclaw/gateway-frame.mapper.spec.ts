import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import {
    connectParams,
    frameOf,
    looksFinal,
    PROTOCOL_VERSION,
    readSessionMessage,
    statusOf,
} from "./gateway-frame.mapper"

const SUBJECT = Symbol("gateway-frame.mapper")
type Subject = Pick<
    typeof import("./gateway-frame.mapper"),
    "connectParams" | "frameOf" | "looksFinal" | "readSessionMessage" | "statusOf"
>

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    connectParams,
                    frameOf,
                    looksFinal,
                    readSessionMessage,
                    statusOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("gateway frame mapper", () => {
    describe("frameOf", () => {
        it("reads an event", async () => {
            const subject = await build()
            expect(subject.frameOf({ type: "event", event: "agent", payload: { status: "ok" } })).toEqual({
                type: "event",
                event: "agent",
                payload: { status: "ok" },
            })
        })

        it("reads a response with its error body", async () => {
            const subject = await build()
            expect(
                subject.frameOf({
                    type: "res",
                    id: "7",
                    ok: false,
                    error: { code: "UNAVAILABLE", message: "starting", details: { retryAfterMs: 2500 } },
                }),
            ).toEqual({
                type: "res",
                id: "7",
                ok: false,
                payload: undefined,
                error: { code: "UNAVAILABLE", message: "starting", retryAfterMs: 2500 },
            })
        })

        it("reads a response with a numeric id, defaults an unnamed error and ignores a non-numeric retry hint", async () => {
            const subject = await build()
            expect(subject.frameOf({ type: "res", id: 3, ok: true, payload: { a: 1 } })).toEqual({
                type: "res",
                id: "3",
                ok: true,
                payload: { a: 1 },
                error: null,
            })
            expect(subject.frameOf({ type: "res", id: "4", error: { details: { retryAfterMs: "soon" } } })).toEqual({
                type: "res",
                id: "4",
                ok: false,
                payload: undefined,
                error: { code: "UNKNOWN", message: "", retryAfterMs: null },
            })
            expect(subject.frameOf({ type: "res", id: "5", error: { code: "X", message: "m" } })).toMatchObject({
                error: { code: "X", message: "m", retryAfterMs: null },
            })
        })

        it("refuses a value that is not a frame", async () => {
            const subject = await build()
            expect(subject.frameOf("text")).toBeNull()
            expect(subject.frameOf([1])).toBeNull()
            expect(subject.frameOf(null)).toBeNull()
            expect(subject.frameOf({ type: "event" })).toBeNull()
            expect(subject.frameOf({ type: "res", id: true })).toBeNull()
            expect(subject.frameOf({ type: "other" })).toBeNull()
        })
    })
})

describe("gateway frame mapper", () => {
    describe("connectParams", () => {
        it("puts a token in the first frame", async () => {
            const subject = await build()
            expect(subject.connectParams({ kind: "token", token: new Secret("t0") }, "linux")).toEqual({
                minProtocol: PROTOCOL_VERSION,
                maxProtocol: PROTOCOL_VERSION,
                client: { id: "cli", version: "1.0.0", platform: "linux", mode: "cli" },
                auth: { token: "t0" },
                role: "operator",
                scopes: ["operator.read", "operator.write"],
            })
        })

        it("puts a password in the first frame", async () => {
            const subject = await build()
            expect(subject.connectParams({ kind: "password", password: new Secret("pw") }, "win32")).toMatchObject({
                auth: { password: "pw" },
            })
        })
    })
})

describe("gateway frame mapper", () => {
    describe("readSessionMessage", () => {
        it("narrows an assistant message with usage and a provider-qualified model", async () => {
            const subject = await build()
            expect(
                subject.readSessionMessage({
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
                threadKey: "agent:a:c",
                role: "assistant",
                fromOwner: false,
                text: "Hello\nthere",
                stopReason: "stop",
                usage: { input: 10, output: 5, cacheRead: 2, cacheWrite: 1, cost: 0.5, model: "p/m" },
            })
        })

        it("reads a plain string message under the `key` alias and flags the owner", async () => {
            const subject = await build()
            expect(subject.readSessionMessage({ key: "k", senderIsOwner: true, message: "  hi  " })).toEqual({
                threadKey: "k",
                role: null,
                fromOwner: true,
                text: "hi",
                stopReason: null,
                usage: null,
            })
        })

        it("falls back across text keys and tolerates a model without provider, bad numbers and a missing cost", async () => {
            const subject = await build()
            const read = subject.readSessionMessage({
                message: { body: "from body", model: "solo", usage: { input: -1, output: "x", cacheRead: 4 } },
            })
            expect(read.text).toBe("from body")
            expect(read.usage).toEqual({ input: 0, output: 0, cacheRead: 4, cacheWrite: 0, cost: 0, model: "solo" })
            const nested = { message: { content: { text: "nested" }, usage: { cost: {} } } }
            expect(subject.readSessionMessage(nested)).toMatchObject({
                text: "nested",
                usage: { cost: 0, model: null },
            })
        })

        it("answers an empty message for anything that carries no text", async () => {
            const subject = await build()
            const empty = { threadKey: null, role: null, fromOwner: false, text: null, stopReason: null, usage: null }
            expect(subject.readSessionMessage(null)).toEqual(empty)
            expect(subject.readSessionMessage([])).toEqual(empty)
            expect(subject.readSessionMessage({ message: "   " })).toEqual(empty)
            expect(subject.readSessionMessage({ message: [] })).toEqual(empty)
            expect(subject.readSessionMessage({ message: 5 })).toEqual(empty)
            expect(subject.readSessionMessage({ message: { other: 1 } })).toEqual(empty)
            expect(subject.readSessionMessage({ message: { usage: "x" } })).toEqual(empty)
        })
    })
})

describe("gateway frame mapper", () => {
    describe("statusOf", () => {
        it("reads the status of an agent event and nothing else", async () => {
            const subject = await build()
            expect(subject.statusOf({ status: "done" })).toBe("done")
            expect(subject.statusOf({ status: 3 })).toBeNull()
            expect(subject.statusOf(null)).toBeNull()
        })
    })
})

describe("gateway frame mapper", () => {
    describe("looksFinal", () => {
        it("does not accept a reply marker before an object and handles a long unfinished object prefix", async () => {
            const subject = await build()
            expect(subject.looksFinal('"reply": "before" {')).toBe(false)
            expect(subject.looksFinal("{".repeat(20_000) + "pending")).toBe(false)
            expect(subject.looksFinal("{".repeat(20_000) + '"reply" : "ok"')).toBe(true)
        })

        it("recognises the contract answer only", async () => {
            const subject = await build()
            expect(subject.looksFinal('{"reply": "ok"}')).toBe(true)
            expect(subject.looksFinal('Sure! {"x": 1, "reply" : "ok"}')).toBe(true)
            expect(subject.looksFinal("working on it")).toBe(false)
        })
    })
})
