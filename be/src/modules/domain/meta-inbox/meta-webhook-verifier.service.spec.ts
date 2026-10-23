import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { META_CLIENT } from "@modules/integrations/meta"
import type { MetaClient } from "@modules/integrations/meta"
import { MetaInboxError, MetaInboxErrorCode } from "./errors/meta-inbox.error"
import { MetaWebhookVerifierService } from "./meta-webhook-verifier.service"

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

const RAW = Buffer.from('{ "object": "page", "entry": [] }\n')
const SIGNATURE = "sha256=signature"

const build = async () => {
    const meta = mock<MetaClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [MetaWebhookVerifierService, { provide: META_CLIENT, useValue: meta }],
    }).compile()
    return { verifier: moduleRef.get(MetaWebhookVerifierService), meta }
}

describe("MetaWebhookVerifierService", () => {
    it("proves the exact signed raw bytes without decoding or parsing them", async () => {
        const { verifier, meta } = await build()
        meta.verifyDelivery.mockReturnValue(true)
        expect(verifier.verify(RAW, SIGNATURE)).toBeUndefined()
        expect(meta.verifyDelivery).toHaveBeenCalledTimes(1)
        expect(meta.verifyDelivery).toHaveBeenCalledWith(SIGNATURE, RAW)
        expect(meta.verifyDelivery.mock.calls[0]?.[1]).toBe(RAW)
        expect(meta.parse).not.toHaveBeenCalled()
    })

    it("refuses a missing body without asking the client to verify it", async () => {
        const { verifier, meta } = await build()
        expect(thrownBy(() => verifier.verify(undefined, SIGNATURE))).toEqual(
            objectLike({ code: MetaInboxErrorCode.SignatureInvalid }),
        )
        expect(meta.verifyDelivery).not.toHaveBeenCalled()
    })

    it.each([SIGNATURE, undefined])("refuses a client-rejected signature %p", async (signature) => {
        const { verifier, meta } = await build()
        meta.verifyDelivery.mockReturnValue(false)
        expect(thrownBy(() => verifier.verify(RAW, signature))).toEqual(
            objectLike({ code: MetaInboxErrorCode.SignatureInvalid }),
        )
        expect(meta.verifyDelivery).toHaveBeenCalledWith(signature, RAW)
    })

    it("propagates a provider verification failure", async () => {
        const { verifier, meta } = await build()
        const failure = new MetaInboxError({ code: MetaInboxErrorCode.SignatureInvalid })
        meta.verifyDelivery.mockImplementation(() => {
            throw failure
        })
        expect(() => verifier.verify(RAW, SIGNATURE)).toThrow(failure)
        expect(meta.verifyDelivery).toHaveBeenCalledWith(SIGNATURE, RAW)
    })
})
