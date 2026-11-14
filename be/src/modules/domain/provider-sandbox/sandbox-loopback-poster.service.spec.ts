import { mock } from "@starci/jest-preset"
import type { HttpClient } from "@modules/platform/http"
import { ProviderSandboxErrorCode } from "./errors/provider-sandbox.error"
import { SandboxLoopbackPosterService } from "./sandbox-loopback-poster.service"

describe("SandboxLoopbackPosterService (the one send's road to the provider's own route, R62)", () => {
    it("POSTs the case's body with its headers to this api's own listener only, and answers the route's status and body", async () => {
        const http = mock<HttpClient>()
        http.request.mockResolvedValue({ status: 200, body: '{"success":true}' })
        const poster = new SandboxLoopbackPosterService(http, 3101)

        const reply = await poster.post({ path: "/api/connections/sepay/c-1", body: { id: 1 }, headers: { "x-nivo-sandbox-key": "k" } })

        expect(reply).toEqual({ status: 200, body: { success: true } })
        expect(http.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "POST",
                url: "http://127.0.0.1:3101/api/connections/sepay/c-1",
                headers: { "x-nivo-sandbox-key": "k" },
                body: { id: 1 },
                read: "text",
            }),
        )
    })

    it("answers a refusal as it came (status + body, text kept as text), never throws it", async () => {
        const http = mock<HttpClient>()
        http.request.mockResolvedValue({ status: 401, body: "nope" })

        await expect(new SandboxLoopbackPosterService(http, 1).post({ path: "a", body: {}, headers: {} })).resolves.toEqual({ status: 401, body: "nope" })
    })

    it("refuses in an app that has no own port (no case is sent there)", async () => {
        await expect(new SandboxLoopbackPosterService(mock<HttpClient>(), undefined).post({ path: "a", body: {}, headers: {} })).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.Off,
        })
    })
})
