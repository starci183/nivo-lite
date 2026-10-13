import type { LookupFunction } from "node:net"
import { HttpErrorCode } from "./errors/http.error"
import type { HttpPin } from "./http.port"
import { sendPinned } from "./pinned-request.client"
import type { PinnedInit } from "./pinned-request.client"

type Listener = (payload?: Buffer | Error) => void

class FakeListeners {
    private readonly listeners = new Map<string, Array<Listener>>()

    on(event: string, listener: Listener): void {
        const current = this.listeners.get(event) ?? []
        current.push(listener)
        this.listeners.set(event, current)
    }

    emit(event: string, payload?: Buffer | Error): void {
        for (const listener of this.listeners.get(event) ?? []) listener(payload)
    }
}

class FakeResponse extends FakeListeners {
    statusCode: number | undefined = 200
    headers: Record<string, string | Array<string> | undefined> = { "content-type": "text/plain" }
}

class FakeRequest extends FakeListeners {
    readonly written: Array<string | Buffer> = []
    ended = false
    destroyed: Error | undefined = undefined

    write(body: string | Buffer): void {
        this.written.push(body)
    }

    end(): void {
        this.ended = true
    }

    destroy(error?: Error): void {
        this.destroyed = error
        if (error !== undefined) this.emit("error", error)
    }
}

class MockSockets {
    protocol = ""
    options: { lookup?: LookupFunction; signal?: AbortSignal; method?: string; timeout?: number } = {}
    request = new FakeRequest()
    response = new FakeResponse()
    auto = true

    reset(): void {
        this.protocol = ""
        this.options = {}
        this.request = new FakeRequest()
        this.response = new FakeResponse()
        this.auto = true
    }
}

const mockSockets = new MockSockets()

const open =
    (protocol: string) => (_url: URL, options: MockSockets["options"], callback: (res: FakeResponse) => void) => {
        mockSockets.protocol = protocol
        mockSockets.options = options
        const request = mockSockets.request
        const response = mockSockets.response
        if (mockSockets.auto) callback(response)
        return request
    }

jest.mock("node:http", () => ({ request: (...args: Parameters<ReturnType<typeof open>>) => open("http")(...args) }))
jest.mock("node:https", () => ({ request: (...args: Parameters<ReturnType<typeof open>>) => open("https")(...args) }))

const pin: HttpPin = { address: "203.0.113.5", family: 4 }
const init = (partial: Partial<PinnedInit> = {}): PinnedInit => ({
    method: "GET",
    headers: { accept: "text/plain" },
    body: undefined,
    timeoutMs: 1000,
    ...partial,
})

describe("sendPinned", () => {
    beforeEach(() => {
        mockSockets.reset()
    })

    it("reads an https answer and pins the lookup to the checked address", async () => {
        mockSockets.response.statusCode = undefined
        mockSockets.response.headers = { "x-one": ["a", "b"], "x-missing": undefined }
        const pending = sendPinned(
            new URL("https://shop.example/orders"),
            pin,
            init({ body: "hi", signal: AbortSignal.abort() }),
        )
        mockSockets.response.emit("data", Buffer.from("hel"))
        mockSockets.response.emit("data", Buffer.from("lo"))
        mockSockets.response.emit("end")

        await expect(pending).resolves.toEqual({
            status: 0,
            headers: { "x-one": "a, b", "x-missing": "" },
            body: Buffer.from("hello"),
        })
        expect(mockSockets.protocol).toBe("https")
        expect(mockSockets.request.written).toEqual(["hi"])
        expect(mockSockets.request.ended).toBe(true)
        expect(mockSockets.options.signal?.aborted).toBe(true)

        const lookup = mockSockets.options.lookup
        const all = jest.fn()
        const one = jest.fn()
        lookup?.("shop.example", { all: true }, all)
        lookup?.("shop.example", {}, one)
        expect(all).toHaveBeenCalledWith(null, [{ address: "203.0.113.5", family: 4 }])
        expect(one).toHaveBeenCalledWith(null, "203.0.113.5", 4)
    })

    it("uses http when the url is not https and omits an absent body and signal", async () => {
        const pending = sendPinned(new URL("http://shop.example/health"), { address: "203.0.113.9", family: 6 }, init())
        mockSockets.response.emit("end")

        await expect(pending).resolves.toMatchObject({ status: 200, body: Buffer.alloc(0) })
        expect(mockSockets.protocol).toBe("http")
        expect(mockSockets.request.written).toEqual([])
        expect(mockSockets.options.signal).toBeUndefined()
    })

    it("cuts a body over the cap and reports a timeout separately from a network error", async () => {
        const huge = sendPinned(new URL("https://shop.example/big"), pin, init())
        mockSockets.response.emit("data", Buffer.alloc(25_000_001))
        await expect(huge).rejects.toMatchObject({ code: HttpErrorCode.Network, cause: mockSockets.request.destroyed })

        mockSockets.reset()
        mockSockets.auto = false
        const timed = sendPinned(new URL("https://shop.example/slow"), pin, init())
        mockSockets.request.emit("timeout")
        await expect(timed).rejects.toMatchObject({ code: HttpErrorCode.Timeout })

        mockSockets.reset()
        const failed = sendPinned(new URL("https://shop.example/down"), pin, init())
        const cause = new Error("reset")
        mockSockets.response.emit("error", cause)
        await expect(failed).rejects.toMatchObject({ code: HttpErrorCode.Network, cause })
    })
})
