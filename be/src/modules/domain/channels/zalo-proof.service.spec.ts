import { createHash } from "node:crypto"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WEBHOOK_PROOF_REGISTRY } from "@modules/platform/http-security"
import type { WebhookProofRegistry } from "@modules/platform/http-security"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelsErrorCode } from "./errors/channels.error"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ZaloProofService } from "./zalo-proof.service"

const CONNECTION = "0b1d52a4-8f3e-4c8a-9a64-4f0d2f6e7a11"
const BODY = JSON.stringify({ app_id: "app-1", timestamp: 1730000000000 })
const MAC = createHash("sha256").update(`app-1${BODY}1730000000000oa-secret`).digest("hex")

const build = async (found: boolean) => {
    const credentials = mock<ZaloCredentialsService>()
    credentials.load.mockResolvedValue(
        found
            ? {
                  kind: "ok",
                  value: {
                      secret: { appId: "app-1", appSecret: "s", oaSecret: "oa-secret" },
                      expiresAt: null,
                      workspaceId: "ws-1",
                  },
              }
            : { kind: "refused", code: ChannelsErrorCode.ConnectionNotFound },
    )
    const registry = mock<WebhookProofRegistry>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloProofService,
            { provide: WEBHOOK_PROOF_REGISTRY, useValue: registry },
            { provide: LOGGER, useValue: logger },
            { provide: ZaloCredentialsService, useValue: credentials },
        ],
    }).compile()
    return { proof: moduleRef.get(ZaloProofService), registry, credentials, logger }
}

const request = (scope: string, rawBody: Buffer | undefined, signature: string) => ({
    scope,
    rawBody,
    signature,
    timestamp: undefined,
})

describe("ZaloProofService", () => {
    it("registers itself for the zalo door when the module starts", async () => {
        const { proof, registry } = await build(true)

        proof.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith(proof)
    })

    describe("prove", () => {
        it("accepts the mac made with the OA secret key of the connection the route names", async () => {
            const { proof, credentials } = await build(true)

            await expect(proof.prove(request(CONNECTION, Buffer.from(BODY), `mac=${MAC}`))).resolves.toBe(true)
            expect(credentials.load).toHaveBeenCalledWith(CONNECTION)
        })

        it("refuses a wrong mac, a missing body, a route that is not a connection id and a connection that is gone", async () => {
            const wrong = await build(true)
            const gone = await build(false)

            await expect(wrong.proof.prove(request(CONNECTION, Buffer.from(BODY), "mac=00"))).resolves.toBe(false)
            await expect(wrong.proof.prove(request(CONNECTION, undefined, MAC))).resolves.toBe(false)
            await expect(wrong.proof.prove(request("x", Buffer.from(BODY), MAC))).resolves.toBe(false)
            await expect(gone.proof.prove(request(CONNECTION, Buffer.from(BODY), MAC))).resolves.toBe(false)
        })

        it("refuses and logs a body that is not JSON", async () => {
            const { proof, logger } = await build(true)

            await expect(proof.prove(request(CONNECTION, Buffer.from("not json"), MAC))).resolves.toBe(false)
            expect(logger.warn).toHaveBeenCalledWith(
                "channels.proof.body-unreadable",
                expect.objectContaining({ connectionId: CONNECTION }),
            )
        })
    })
})
