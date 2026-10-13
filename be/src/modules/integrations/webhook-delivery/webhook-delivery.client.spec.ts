import { lookup } from "node:dns/promises"
import type { LookupAddress, LookupAllOptions } from "node:dns"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { WebhookDeliveryError, WebhookDeliveryErrorCode } from "./errors/webhook-delivery.error"
import { WebhookDeliveryClient } from "./webhook-delivery.client"
import { WEBHOOK_DELIVERY_OPTIONS } from "./webhook-delivery.decorators"

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }))

const lookupMock = jest.mocked<(hostname: string, options: LookupAllOptions) => Promise<Array<LookupAddress>>>(lookup)
const NOW = "2026-10-12T03:00:00.000Z"

const build = async () => {
    const clock = new FakeClock(NOW)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WebhookDeliveryClient,
            { provide: WEBHOOK_DELIVERY_OPTIONS, useValue: { timeoutMs: 4000 } },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return { client: moduleRef.get(WebhookDeliveryClient), clock }
}

describe("WebhookDeliveryClient", () => {
    beforeEach(() => {
        lookupMock.mockReset()
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe("resolveTarget", () => {
        it.each([
            ["not a URL", "url"],
            ["ftp://receiver.test/hook", "scheme"],
            ["https://user:password@receiver.test/hook", "credentials"],
        ])("refuses %s with reason %s before resolving DNS", async (raw, reason) => {
            const { client } = await build()
            const error: unknown = await client.resolveTarget(raw, true).catch((cause: unknown) => cause)

            expect(error).toBeInstanceOf(WebhookDeliveryError)
            expect(error).toEqual(
                new WebhookDeliveryError({ code: WebhookDeliveryErrorCode.TargetRefused, params: { reason } }),
            )
            expect(error).toHaveProperty("code", WebhookDeliveryErrorCode.TargetRefused)
            expect(error).toHaveProperty("params", { reason })
            expect(lookupMock).not.toHaveBeenCalled()
        })

        it.each(["http://localhost:3100/hook", "https://10.0.0.1/hook"])(
            "allows %s without DNS on a local site",
            async (raw) => {
                const { client } = await build()

                await expect(client.resolveTarget(`  ${raw}  `, false)).resolves.toEqual(new URL(raw))
                expect(lookupMock).not.toHaveBeenCalled()
            },
        )

        it.each(["https://8.8.8.8/hook", "https://[2001:4860:4860::8888]/hook"])(
            "accepts the public IP literal %s without DNS",
            async (raw) => {
                const { client } = await build()

                await expect(client.resolveTarget(raw, true)).resolves.toEqual(new URL(raw))
                expect(lookupMock).not.toHaveBeenCalled()
            },
        )

        it("accepts a hostname only after checking every resolved address", async () => {
            const { client } = await build()
            lookupMock.mockResolvedValue([
                { address: "8.8.8.8", family: 4 },
                { address: "2001:4860:4860::8888", family: 6 },
            ])

            await expect(client.resolveTarget("  https://receiver.test:8443/hook?key=1  ", true)).resolves.toEqual(
                new URL("https://receiver.test:8443/hook?key=1"),
            )
            expect(lookupMock).toHaveBeenCalledTimes(1)
            expect(lookupMock).toHaveBeenCalledWith("receiver.test", { all: true })
        })

        it.each(["http://127.0.0.1/hook", "https://[::1]/hook"])("refuses the private IP literal %s", async (raw) => {
            const { client } = await build()
            const error: unknown = await client.resolveTarget(raw, true).catch((cause: unknown) => cause)

            expect(error).toBeInstanceOf(WebhookDeliveryError)
            expect(error).toHaveProperty("code", WebhookDeliveryErrorCode.TargetRefused)
            expect(error).toHaveProperty("params", { reason: "private" })
            expect(lookupMock).not.toHaveBeenCalled()
        })

        it("refuses a hostname when any resolved address is private", async () => {
            const { client } = await build()
            lookupMock.mockResolvedValue([
                { address: "8.8.8.8", family: 4 },
                { address: "10.0.0.1", family: 4 },
            ])
            const error: unknown = await client
                .resolveTarget("https://receiver.test/hook", true)
                .catch((cause: unknown) => cause)

            expect(error).toBeInstanceOf(WebhookDeliveryError)
            expect(error).toHaveProperty("code", WebhookDeliveryErrorCode.TargetRefused)
            expect(error).toHaveProperty("params", { reason: "private" })
            expect(lookupMock).toHaveBeenCalledWith("receiver.test", { all: true })
        })

        it.each(["empty answer", "lookup failure"])("refuses a host after %s", async (scenario) => {
            const { client } = await build()
            if (scenario === "empty answer") lookupMock.mockResolvedValue([])
            else lookupMock.mockRejectedValue(new Error("DNS unavailable"))
            const error: unknown = await client
                .resolveTarget("https://missing.test/hook", true)
                .catch((cause: unknown) => cause)

            expect(error).toBeInstanceOf(WebhookDeliveryError)
            expect(error).toHaveProperty("code", WebhookDeliveryErrorCode.TargetRefused)
            expect(error).toHaveProperty("params", { reason: "host_not_found" })
            expect(lookupMock).toHaveBeenCalledTimes(1)
            expect(lookupMock).toHaveBeenCalledWith("missing.test", { all: true })
        })
    })

    describe("post", () => {
        it.each([200, 299, 302, 503])("posts once and reports HTTP %i with the elapsed time", async (status) => {
            const { client, clock } = await build()
            const signal = new AbortController().signal
            const timeout = jest.spyOn(AbortSignal, "timeout").mockReturnValue(signal)
            const fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async () => {
                clock.advance(43)
                return mock<Response>({ status })
            })
            const url = new URL("https://receiver.test/hook")
            const body = '{"event":"lead.created"}'

            await expect(
                client.post({ url, body, headers: { "x-nivo-event": "lead.created", "x-nivo-signature": "signed" } }),
            ).resolves.toEqual({ status, failure: null, durationMs: 43 })
            expect(timeout).toHaveBeenCalledTimes(1)
            expect(timeout).toHaveBeenCalledWith(4000)
            expect(fetchSpy).toHaveBeenCalledTimes(1)
            expect(fetchSpy).toHaveBeenCalledWith(url, {
                method: "POST",
                redirect: "manual",
                signal,
                headers: {
                    "content-type": "application/json",
                    "x-nivo-event": "lead.created",
                    "x-nivo-signature": "signed",
                },
                body,
            })
        })

        it("lets the supplied headers override the default JSON content type", async () => {
            const { client } = await build()
            const signal = new AbortController().signal
            jest.spyOn(AbortSignal, "timeout").mockReturnValue(signal)
            const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(mock<Response>({ status: 204 }))
            const url = new URL("https://receiver.test/hook")

            await expect(
                client.post({ url, body: "{}", headers: { "content-type": "application/custom+json" } }),
            ).resolves.toEqual({ status: 204, failure: null, durationMs: 0 })
            expect(fetchSpy).toHaveBeenCalledWith(url, {
                method: "POST",
                redirect: "manual",
                signal,
                headers: { "content-type": "application/custom+json" },
                body: "{}",
            })
        })

        it.each([
            { cause: Object.assign(new Error("deadline"), { name: "TimeoutError" }), failure: "timeout" },
            { cause: Object.assign(new Error("aborted"), { name: "AbortError" }), failure: "timeout" },
            { cause: new Error("connection refused"), failure: "unreachable" },
            { cause: "offline", failure: "unreachable" },
            { cause: null, failure: "unreachable" },
        ])("reports $failure for $cause and preserves elapsed time", async ({ cause, failure }) => {
            const { client, clock } = await build()
            const signal = new AbortController().signal
            jest.spyOn(AbortSignal, "timeout").mockReturnValue(signal)
            const fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async () => {
                clock.advance(71)
                throw cause
            })
            const url = new URL("https://receiver.test/hook")

            await expect(client.post({ url, body: "{}", headers: {} })).resolves.toEqual({
                status: null,
                failure,
                durationMs: 71,
            })
            expect(fetchSpy).toHaveBeenCalledTimes(1)
            expect(fetchSpy).toHaveBeenCalledWith(url, {
                method: "POST",
                redirect: "manual",
                signal,
                headers: { "content-type": "application/json" },
                body: "{}",
            })
        })
    })
})
