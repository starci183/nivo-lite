import { createGatewaySocket } from "./gateway-socket.client"

type Handler = (event: { data?: unknown; type?: string; code?: number }) => void

/** The platform socket as a spec sees it: every member records its calls. */
class StubWebSocket {
    static last: StubWebSocket | null = null
    readonly addEventListener = jest.fn<void, [string, Handler]>()
    readonly send = jest.fn<void, [string]>()
    readonly close = jest.fn<void, []>()

    constructor(readonly url: string) {
        StubWebSocket.last = this
    }

    /** The handler registered for an event type. */
    handlerOf(type: string): Handler {
        const call = this.addEventListener.mock.calls.find(([registered]) => registered === type)
        return call === undefined ? () => undefined : call[1]
    }
}

describe("createGatewaySocket", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "WebSocket")

    beforeEach(() => {
        Object.defineProperty(globalThis, "WebSocket", { value: StubWebSocket, configurable: true, writable: true })
    })

    afterEach(() => {
        if (original !== undefined) Object.defineProperty(globalThis, "WebSocket", original)
    })

    const open = () => {
        const socket = createGatewaySocket("ws://gateway:18789")
        return { socket, stub: StubWebSocket.last ?? new StubWebSocket("unopened") }
    }

    it("opens the address, sends and closes through the platform socket", () => {
        const { socket, stub } = open()

        socket.send("frame")
        socket.close()

        expect(stub.url).toBe("ws://gateway:18789")
        expect(stub.send).toHaveBeenCalledWith("frame")
        expect(stub.close).toHaveBeenCalledTimes(1)
    })

    it("hands text, binary and other message data to the receiver as text", () => {
        const { socket, stub } = open()
        const receiver = jest.fn<void, [string]>()
        socket.onMessage(receiver)

        stub.handlerOf("message")({ data: "plain" })
        stub.handlerOf("message")({ data: new TextEncoder().encode("binary").buffer })
        stub.handlerOf("message")({ data: 42 })

        expect(receiver.mock.calls).toEqual([["plain"], ["binary"], ["42"]])
    })

    it("reports the error type and the close code", () => {
        const { socket, stub } = open()
        const onError = jest.fn<void, [string]>()
        const onClose = jest.fn<void, [number]>()
        socket.onError(onError)
        socket.onClose(onClose)

        stub.handlerOf("error")({ type: "error" })
        stub.handlerOf("close")({ code: 1006 })

        expect(onError).toHaveBeenCalledWith("error")
        expect(onClose).toHaveBeenCalledWith(1006)
    })
})
