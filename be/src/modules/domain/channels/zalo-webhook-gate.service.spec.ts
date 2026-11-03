import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChannelsErrorCode } from "./errors/channels.error"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ZaloWebhookGateService } from "./zalo-webhook-gate.service"

const CONNECTION = "ff2e59dc-5ed2-4327-8a73-ca3526bc3b6f"

const build = async () => {
    const credentials = mock<ZaloCredentialsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [ZaloWebhookGateService, { provide: ZaloCredentialsService, useValue: credentials }],
    }).compile()
    return { gate: moduleRef.get(ZaloWebhookGateService), credentials }
}

describe("ZaloWebhookGateService", () => {
    it("holds the proof key when the connection's credential carries its OA secret key", async () => {
        const { gate, credentials } = await build()
        credentials.load.mockResolvedValue({
            kind: "ok",
            value: { secret: { appId: "app-1", appSecret: "s", oaSecret: "oa" }, expiresAt: null, workspaceId: "ws-1" },
        })

        await expect(gate.holdsProofKey(CONNECTION)).resolves.toBe(true)
        expect(credentials.load).toHaveBeenCalledWith(CONNECTION)
    })

    it.each([ChannelsErrorCode.SecretUnreadable, ChannelsErrorCode.ConnectionNotFound])(
        "holds no proof key for a connection that is refused (%s)",
        async (code) => {
            const { gate, credentials } = await build()
            credentials.load.mockResolvedValue({ kind: "refused", code })

            await expect(gate.holdsProofKey(CONNECTION)).resolves.toBe(false)
        },
    )
})
