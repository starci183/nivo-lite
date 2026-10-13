import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { N8nErrorCode } from "./errors/n8n.error"
import { N8nClient } from "./n8n.client"
import type { N8nDelivery } from "./n8n.contracts"
import { N8N_HOST_RESOLVER, N8N_OPTIONS } from "./n8n.decorators"
import { N8nLogEvent } from "./n8n.log-events"
import type { N8nOptions } from "./n8n.options"
import { signBody, workspaceKey } from "./n8n.policy"

const optionsOf = builder<N8nOptions>({
    signingSecret: new Secret("shared-secret"),
    webhookBase: undefined,
    allowedHosts: ["n8n"],
    timeoutMs: 5000,
})

const deliveryOf = builder<N8nDelivery>({
    deliveryId: "run-1",
    workspaceId: "ws-1",
    event: "pipeline.email-daily-report",
    urls: ["http://n8n:5678/webhook/nivo/email-daily-report"],
    paths: [],
    data: { run_id: "run-1" },
    occurredAtMs: 1_700_000_000_000,
})

const build = async (options: N8nOptions = optionsOf()) => {
    const http = mock<HttpClient>()
    http.request.mockResolvedValue({ status: 200, body: { message: "started" } })
    const logger = mock<Logger>()
    const resolve = jest.fn<Promise<ReadonlyArray<string>>, [string]>().mockResolvedValue(["8.8.8.8"])
    const moduleRef = await Test.createTestingModule({
        providers: [
            N8nClient,
            { provide: N8N_OPTIONS, useValue: options },
            { provide: N8N_HOST_RESOLVER, useValue: resolve },
            { provide: HTTP_CLIENT, useValue: http },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client: moduleRef.get(N8nClient), http, logger, resolve }
}

describe("N8nClient", () => {
    describe("deliver", () => {
        it("posts the signed body to the target and answers what it said", async () => {
            const { client, http } = await build()

            await expect(client.deliver(deliveryOf())).resolves.toEqual([
                { origin: "http://n8n:5678", ok: true, status: 200, transient: false },
            ])

            const request = http.request.mock.calls[0]?.[0]
            const body = JSON.stringify({
                id: "run-1",
                event: "pipeline.email-daily-report",
                workspace_id: "ws-1",
                occurred_at: "2023-11-14T22:13:20.000Z",
                data: { run_id: "run-1" },
            })
            expect(request).toMatchObject({
                method: "POST",
                url: "http://n8n:5678/webhook/nivo/email-daily-report",
                timeoutMs: 5000,
                headers: {
                    "content-type": "application/json",
                    "x-nivo-event": "pipeline.email-daily-report",
                    "x-nivo-delivery": "run-1",
                    "x-nivo-timestamp": "1700000000000",
                    "x-nivo-signature": signBody(workspaceKey("shared-secret", "ws-1"), "1700000000000", body),
                },
            })
            expect(request?.bytes?.toString()).toBe(body)
        })

        it("builds the target of a path under the base and keeps at most five targets", async () => {
            const { client, http } = await build(optionsOf({ webhookBase: "http://n8n:5678/webhook/" }))

            await client.deliver(deliveryOf({ urls: [], paths: ["/nivo/email-daily-report"] }))
            await client.deliver(deliveryOf({ urls: Array.from({ length: 8 }, (_, i) => `http://n8n:5678/${i}`) }))

            expect(http.request.mock.calls[0]?.[0].url).toBe("http://n8n:5678/webhook/nivo/email-daily-report")
            expect(http.request).toHaveBeenCalledTimes(1 + 5)
        })

        it("refuses a delivery with no target at all", async () => {
            const { client, http } = await build()

            await expect(client.deliver(deliveryOf({ urls: [], paths: ["nivo/x"] }))).rejects.toMatchObject({
                code: N8nErrorCode.NoTarget,
            })
            expect(http.request).not.toHaveBeenCalled()
        })

        it("refuses an event name that is not a dotted identifier", async () => {
            const { client } = await build()

            await expect(client.deliver(deliveryOf({ event: "bad event" }))).rejects.toMatchObject({
                code: N8nErrorCode.EventInvalid,
            })
        })

        it("throws a retryable error when a target answers with a transient status", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce({ status: 503, body: undefined })

            await expect(client.deliver(deliveryOf())).rejects.toMatchObject({
                code: N8nErrorCode.DeliveryFailed,
                params: { targets: 1 },
            })
        })

        it("throws a retryable error when the network fails", async () => {
            const { client, http, logger } = await build()
            http.request.mockRejectedValueOnce(new HttpError({ code: HttpErrorCode.Network }))

            await expect(client.deliver(deliveryOf())).rejects.toMatchObject({ code: N8nErrorCode.DeliveryFailed })
            expect(logger.warn).toHaveBeenCalledWith(N8nLogEvent.TargetFailed, {
                event: "pipeline.email-daily-report",
                origin: "http://n8n:5678",
            })
        })

        it("refuses for good when every target is refused or answers with a final status", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce({ status: 404, body: undefined })

            await expect(client.deliver(deliveryOf())).rejects.toMatchObject({
                code: N8nErrorCode.TargetRefused,
                params: { targets: 1 },
            })
            await expect(client.deliver(deliveryOf({ urls: ["http://127.0.0.1/x"] }))).rejects.toMatchObject({
                code: N8nErrorCode.TargetRefused,
            })
            await expect(client.deliver(deliveryOf({ urls: ["not a url"] }))).rejects.toMatchObject({
                code: N8nErrorCode.TargetRefused,
            })
        })

        it("answers the targets that accepted when another was refused for good", async () => {
            const { client } = await build()

            await expect(
                client.deliver(deliveryOf({ urls: ["http://n8n:5678/a", "http://127.0.0.1/x"] })),
            ).resolves.toEqual([
                { origin: "http://n8n:5678", ok: true, status: 200, transient: false },
                { origin: "http://127.0.0.1", ok: false, status: undefined, transient: false },
            ])
        })

        it("counts an unreadable answer body as delivered", async () => {
            const { client, http, logger } = await build()
            http.request.mockRejectedValueOnce(new HttpError({ code: HttpErrorCode.BodyUnreadable }))

            await expect(client.deliver(deliveryOf())).resolves.toEqual([
                { origin: "http://n8n:5678", ok: true, status: undefined, transient: false },
            ])
            expect(logger.warn).not.toHaveBeenCalled()
        })

        it("treats a thrown value that is not an error as a transient failure", async () => {
            const { client, http } = await build()
            http.request.mockRejectedValueOnce("socket closed")

            await expect(client.deliver(deliveryOf())).rejects.toMatchObject({ code: N8nErrorCode.DeliveryFailed })
        })
    })
})
