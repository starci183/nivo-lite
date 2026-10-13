import http, { IncomingMessage } from "node:http"
import type { ClientRequest, RequestOptions } from "node:http"
import https from "node:https"
import type { RequestOptions as SecureRequestOptions } from "node:https"
import { Socket } from "node:net"
import { mock } from "@starci/jest-preset"
import { HttpErrorCode } from "./errors/http.error"
import type { HttpPin } from "./http.port"
import { sendPinned } from "./pinned-request.client"
import type { PinnedInit } from "./pinned-request.client"

/** One request the client opened: what it asked for, what it wrote, and the answer the test feeds it. */
class Exchange {
    protocol = ""
    options: RequestOptions = {}
    auto = true
    ended = false
    destroyed: Error | undefined = undefined
    readonly written: Array<unknown> = []
    readonly requestListeners = new Map<string | symbol, Array<(...args: ReadonlyArray<unknown>) => void>>()
    readonly response = new IncomingMessage(new Socket())
    readonly onRequest = jest.fn<ClientRequest, Parameters<ClientRequest["on"]>>()
    readonly request = mock<ClientRequest>({ on: this.onRequest })

    constructor() {
        this.response.statusCode = 200
        this.response.headers = { "content-type": "text/plain" }
        this.onRequest.mockImplementation((event, listener) => {
            const listeners = this.requestListeners.get(event) ?? []
            listeners.push(listener)
            this.requestListeners.set(event, listeners)
            return this.request
        })
        this.request.write.mockImplementation((chunk) => {
            this.written.push(chunk)
            return true
        })
        this.request.end.mockImplementation(() => {
            this.ended = true
            return this.request
        })
        this.request.destroy.mockImplementation((error) => {
            this.destroyed = error
            if (error !== undefined) this.emitRequest("error", error)
            return this.request
        })
        jest.spyOn(http, "request").mockImplementation(this.answering("http"))
        jest.spyOn(https, "request").mockImplementation(this.answering("https"))
    }

    emitRequest(event: string, error?: Error): void {
        for (const listener of this.requestListeners.get(event) ?? []) listener(error)
    }

    private answering(protocol: string) {
        return (
            _url: string | URL,
            options: SecureRequestOptions,
            callback?: (res: IncomingMessage) => void,
        ): ClientRequest => {
            this.protocol = protocol
            this.options = options
            if (this.auto && callback !== undefined) callback(this.response)
            return this.request
        }
    }
}

const pin: HttpPin = { address: "203.0.113.5", family: 4 }
const init = (partial: Partial<PinnedInit> = {}): PinnedInit => ({
    method: "GET",
    headers: { accept: "text/plain" },
    body: undefined,
    timeoutMs: 1000,
    ...partial,
})

describe("sendPinned", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("reads an https answer and pins the lookup to the checked address", async () => {
        const exchange = new Exchange()
        exchange.response.statusCode = undefined
        exchange.response.headers = { "x-one": ["a", "b"], "x-missing": undefined }
        const pending = sendPinned(
            new URL("https://shop.example/orders"),
            pin,
            init({ body: "hi", signal: AbortSignal.abort() }),
        )
        exchange.response.emit("data", Buffer.from("hel"))
        exchange.response.emit("data", Buffer.from("lo"))
        exchange.response.emit("end")

        await expect(pending).resolves.toEqual({
            status: 0,
            headers: { "x-one": "a, b", "x-missing": "" },
            body: Buffer.from("hello"),
        })
        expect(exchange.protocol).toBe("https")
        expect(exchange.written).toEqual(["hi"])
        expect(exchange.ended).toBe(true)
        expect(exchange.options.signal?.aborted).toBe(true)

        const lookup = exchange.options.lookup
        const all = jest.fn()
        const one = jest.fn()
        lookup?.("shop.example", { all: true }, all)
        lookup?.("shop.example", {}, one)
        expect(all).toHaveBeenCalledWith(null, [{ address: "203.0.113.5", family: 4 }])
        expect(one).toHaveBeenCalledWith(null, "203.0.113.5", 4)
    })

    it("uses http when the url is not https and omits an absent body and signal", async () => {
        const exchange = new Exchange()
        const pending = sendPinned(new URL("http://shop.example/health"), { address: "203.0.113.9", family: 6 }, init())
        exchange.response.emit("end")

        await expect(pending).resolves.toMatchObject({ status: 200, body: Buffer.alloc(0) })
        expect(exchange.protocol).toBe("http")
        expect(exchange.written).toEqual([])
        expect(exchange.options.signal).toBeUndefined()
    })

    it("cuts a body over the cap and reports a network error", async () => {
        const exchange = new Exchange()
        const huge = sendPinned(new URL("https://shop.example/big"), pin, init())
        exchange.response.emit("data", Buffer.alloc(25_000_001))
        await expect(huge).rejects.toMatchObject({ code: HttpErrorCode.Network, cause: exchange.destroyed })
    })

    it("reports a request timeout separately from a network error", async () => {
        const exchange = new Exchange()
        exchange.auto = false
        const timed = sendPinned(new URL("https://shop.example/slow"), pin, init())
        exchange.emitRequest("timeout")
        await expect(timed).rejects.toMatchObject({ code: HttpErrorCode.Timeout })
    })

    it("reports a response error as a network error", async () => {
        const exchange = new Exchange()
        const failed = sendPinned(new URL("https://shop.example/down"), pin, init())
        const cause = new Error("reset")
        exchange.response.emit("error", cause)
        await expect(failed).rejects.toMatchObject({ code: HttpErrorCode.Network, cause })
    })
})
