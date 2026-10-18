import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { WebhookDeliveryErrorCode } from "./errors/webhook-delivery.error"
import { SimulationPostClient } from "./simulation-post.client"

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [SimulationPostClient, { provide: HTTP_CLIENT, useValue: http }],
    }).compile()
    return { client: moduleRef.get(SimulationPostClient), http }
}

const delivery = {
    url: "https://receiver.test/hooks",
    headers: { "Content-Type": "application/json", "X-Token": "signed" },
    body: '{"message":"สวัสดี"}',
}

describe("SimulationPostClient", () => {
    it("posts the exact serialized bytes with lowercase headers and returns the complete text reply", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 422, body: "refused\nwith details" })

        await expect(client.post(delivery)).resolves.toEqual({ status: 422, text: "refused\nwith details" })
        expect(http.request).toHaveBeenCalledTimes(1)
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: delivery.url,
            headers: { "content-type": "application/json", "x-token": "signed" },
            bytes: Buffer.from(delivery.body),
            read: "text",
            timeoutMs: 15_000,
        })
    })

    it.each([undefined, null, { message: "parsed" }, Buffer.from("bytes")])(
        "answers empty text for a nonstring response body %p",
        async (body) => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 204, body })

            await expect(client.post(delivery)).resolves.toEqual({ status: 204, text: "" })
            expect(http.request).toHaveBeenCalledTimes(1)
        },
    )
})

describe("SimulationPostClient transport failures", () => {
    it("keeps the original HTTP failure as the owning simulation error's cause", async () => {
        const { client, http } = await build()
        const cause = new Error("socket closed")
        http.request.mockRejectedValue(new HttpError({ code: HttpErrorCode.Network, cause }))

        await expect(client.post(delivery)).rejects.toMatchObject({
            code: WebhookDeliveryErrorCode.SimulationFailed,
            cause,
        })
        expect(http.request).toHaveBeenCalledTimes(1)
    })

    it("preserves a failure supplied directly by the transport", async () => {
        const { client, http } = await build()
        const cause = { reason: "connection refused" }
        http.request.mockRejectedValue(cause)

        await expect(client.post(delivery)).rejects.toMatchObject({
            code: WebhookDeliveryErrorCode.SimulationFailed,
            cause,
        })
        expect(http.request).toHaveBeenCalledTimes(1)
    })
    it("keeps an HTTP error without a nested cause intact for diagnostics", async () => {
        const { client, http } = await build()
        const cause = new HttpError({ code: HttpErrorCode.Network })
        http.request.mockRejectedValue(cause)

        await expect(client.post(delivery)).rejects.toMatchObject({
            code: WebhookDeliveryErrorCode.SimulationFailed,
            cause,
        })
        expect(http.request).toHaveBeenCalledTimes(1)
    })
})
