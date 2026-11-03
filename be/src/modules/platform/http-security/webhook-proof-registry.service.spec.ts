import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { REFUSAL_LOG_WINDOW_MS, WebhookProofRegistryService } from "./webhook-proof-registry.service"
import type { WebhookProof } from "./webhook-proof.port"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const build = async () => {
    const clock = new FakeClock(new Date("2026-11-04T10:00:00.000Z"))
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WebhookProofRegistryService,
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { registry: moduleRef.get(WebhookProofRegistryService), clock, logger }
}

const proofOf = (provider: string): WebhookProof => ({ provider, prove: () => Promise.resolve(true) })

describe("WebhookProofRegistryService", () => {
    it("asks the proof registered for a provider with the request", async () => {
        const { registry } = await build()
        const prove = jest.fn().mockResolvedValue(true)
        registry.add({ provider: "zalo", prove })
        const request = { scope: "c1", rawBody: undefined, signature: "mac", timestamp: undefined }

        await expect(registry.verify("zalo", request)).resolves.toBeUndefined()

        expect(prove.mock.calls).toEqual([[request]])
    })

    it("refuses a delivery rejected by the registered proof with the existing error code", async () => {
        const { registry } = await build()
        registry.add({ provider: "zalo", prove: () => Promise.resolve(false) })
        await expect(
            registry.verify("zalo", { scope: "c1", rawBody: undefined, signature: "wrong", timestamp: undefined }),
        ).rejects.toMatchObject({
            code: HttpSecurityErrorCode.WebhookSignatureInvalid,
        })
    })

    it("refuses a provider with no proof registered", async () => {
        const { registry } = await build()

        await expect(
            registry.verify("telegram", {
                scope: "c1",
                rawBody: undefined,
                signature: undefined,
                timestamp: undefined,
            }),
        ).rejects.toMatchObject({ code: HttpSecurityErrorCode.WebhookProviderUnknown })
    })

    it("refuses a second proof for the same provider", async () => {
        const { registry } = await build()
        registry.add(proofOf("zalo"))

        expect(() => registry.add(proofOf("zalo"))).toThrow(HttpSecurityError)
        expect(thrownBy(() => registry.add(proofOf("zalo")))).toEqual(
            objectLike({ code: HttpSecurityErrorCode.WebhookProviderUnknown }),
        )
    })

    describe("the log of a refused proof", () => {
        const refused = (scope: string) => ({
            scope,
            rawBody: Buffer.from("secret body"),
            signature: "mac=abc",
            timestamp: undefined,
        })
        const refusing = (facts?: () => Record<string, string>) => ({
            provider: "zalo",
            prove: () => Promise.resolve(false),
            ...(facts === undefined ? {} : { facts }),
        })

        it("logs the provider, scope, code and the facts the proof allows, and never the body or the signature", async () => {
            const { registry, logger } = await build()
            registry.add(refusing(() => ({ eventName: "user_send_image" })))

            await expect(registry.verify("zalo", refused("c1"))).rejects.toBeInstanceOf(HttpSecurityError)

            expect(logger.warn).toHaveBeenCalledWith("http_security.webhook.refused", {
                provider: "zalo",
                scope: "c1",
                code: HttpSecurityErrorCode.WebhookSignatureInvalid,
                eventName: "user_send_image",
            })
            expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(/secret body|mac=abc/u)
        })

        it("logs a proof with no facts too, once per provider and scope per minute, counting the ones left out", async () => {
            const { registry, clock, logger } = await build()
            registry.add(refusing())

            await expect(registry.verify("zalo", refused("c1"))).rejects.toBeInstanceOf(HttpSecurityError)
            await expect(registry.verify("zalo", refused("c1"))).rejects.toBeInstanceOf(HttpSecurityError)
            await expect(registry.verify("zalo", refused("c1"))).rejects.toBeInstanceOf(HttpSecurityError)
            await expect(registry.verify("zalo", refused("c2"))).rejects.toBeInstanceOf(HttpSecurityError)
            expect(logger.warn).toHaveBeenCalledTimes(2)

            clock.advance(REFUSAL_LOG_WINDOW_MS)
            await expect(registry.verify("zalo", refused("c1"))).rejects.toBeInstanceOf(HttpSecurityError)
            await expect(registry.verify("zalo", refused("c1"))).rejects.toBeInstanceOf(HttpSecurityError)
            clock.advance(REFUSAL_LOG_WINDOW_MS)
            await expect(registry.verify("zalo", refused("c1"))).rejects.toBeInstanceOf(HttpSecurityError)

            expect(logger.warn).toHaveBeenCalledTimes(4)
            expect(logger.warn.mock.calls[2]?.[1]).toMatchObject({ scope: "c1", suppressed: 2 })
            expect(logger.warn.mock.calls[3]?.[1]).toMatchObject({ scope: "c1", suppressed: 1 })

            clock.advance(REFUSAL_LOG_WINDOW_MS)
            await expect(registry.verify("zalo", refused("c1"))).rejects.toBeInstanceOf(HttpSecurityError)
            expect(logger.warn.mock.calls[4]?.[1]).not.toHaveProperty("suppressed")
        })

        it("logs nothing for a delivery the proof accepts", async () => {
            const { registry, logger } = await build()
            registry.add(proofOf("zalo"))

            await registry.verify("zalo", refused("c1"))

            expect(logger.warn).not.toHaveBeenCalled()
        })
    })
})
