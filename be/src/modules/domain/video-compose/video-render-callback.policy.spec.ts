import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { FAKE_SIGNED } from "@tests/fixtures/builders/video-compose.builder"
import { renderCallbackOf as renderCallbackOfSubject } from "./video-render-callback.policy"

const SUBJECT = Symbol("video-render-callback.policy")

const build = async (): Promise<{ renderCallbackOf: typeof renderCallbackOfSubject }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<{ renderCallbackOf: typeof renderCallbackOfSubject }>({ renderCallbackOf: renderCallbackOfSubject }) }],
    }).compile()
    return moduleRef.get<{ renderCallbackOf: typeof renderCallbackOfSubject }>(SUBJECT)
}

describe("the render callback", () => {
    let renderCallbackOf: typeof renderCallbackOfSubject

    beforeAll(async () => {
        ;({ renderCallbackOf } = await build())
    })

    const input = { origin: "https://api.test//", provider: "p", webhook: FAKE_SIGNED, connectionId: "c", webhookSecret: "s/1" }

    it("is the door of the provider and connection with the connection's webhook secret last, each segment encoded", () => {
        expect(renderCallbackOf(input)).toEqual({ url: "https://api.test/api/connections/video-render/p/c/s%2F1" })
    })

    it("is null without a public origin, for a provider with no webhook, or with no secret", () => {
        expect([
            renderCallbackOf({ ...input, origin: null }),
            renderCallbackOf({ ...input, webhook: null }),
            renderCallbackOf({ ...input, webhookSecret: null }),
            renderCallbackOf({ ...input, webhookSecret: "" }),
        ]).toEqual([null, null, null, null])
    })
})
