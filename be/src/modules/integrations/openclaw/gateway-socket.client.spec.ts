import { createGatewaySocket } from "./gateway-socket.client"

type Listener = (event: unknown) => void

class StubWebSocket {
    static last: StubWebSocket | null = null
    readonly listeners = new Map<string, Listener>()
    readonly sent: Array<string> = []
    closed = 0

    constructor(readonly url: string) {
        StubWebSocket.last = this
    }

    addEventListener(type: string, listener: Listener): void {
        this.listeners.set(type, listener)
    }

    send(data: string): void {
        this.sent.push(data)
    }

    close(): void {
        this.closed += 1
    }

    fire(type: string, event: unknown): void {
        this.listeners.get(type)?.(event)
    }
}

describe("createGatewaySocket", () => {
    const original = globalThis.WebSocket

    beforeEach(() => {
        ;(globalThis as { WebSocket: unknown }).WebSocket = StubWebSocket
    })

    afterEach(() => {
        ;(globalThis as { WebSocket: unknown }).WebSocket = original
    })

    it("opens the address, sends and closes through the platform socket", () => {
        const socket = createGatewaySocket("ws://gateway:18789")
        const stub = StubWebSocket.last as StubWebSocket

        socket.send("frame")
        socket.close()

        expect(stub.url).toBe("ws://gateway:18789")
        expect(stub.sent).toEqual(["frame"])
        expect(stub.closed).toBe(1)
    })

    it("hands text, binary and other message data to the listener as text", () => {
        const socket = createGatewaySocket("ws://gateway:18789")
        const stub = StubWebSocket.last as StubWebSocket
        const received: Array<string> = []
        socket.onMessage((data) => received.push(data))

        stub.fire("message", { data: "plain" })
        stub.fire("message", { data: new TextEncoder().encode("binary").buffer })
        stub.fire("message", { data: 42 })

        expect(received).toEqual(["plain", "binary", "42"])
    })

    it("reports the error type and the close code", () => {
        const socket = createGatewaySocket("ws://gateway:18789")
        const stub = StubWebSocket.last as StubWebSocket
        const errors: Array<string> = []
        const codes: Array<number> = []
        socket.onError((message) => errors.push(message))
        socket.onClose((code) => codes.push(code))

        stub.fire("error", { type: "error" })
        stub.fire("close", { code: 1006 })

        expect(errors).toEqual(["error"])
        expect(codes).toEqual([1006])
    })
})
