import { Test } from "@nestjs/testing"
import { maskedWebhookUrl } from "./webhook-url-mask.policy"

const SUBJECT = Symbol("webhook-url-mask.policy")
type Subject = { maskedWebhookUrl: typeof maskedWebhookUrl }

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { maskedWebhookUrl } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("webhook url mask policy maskedWebhookUrl", () => {
    it("keeps the scheme, host and a readable path", async () => {
        const policy = await build()
        expect(policy.maskedWebhookUrl(new URL("https://n8n.shop.vn/webhook/don-moi"))).toBe(
            "https://n8n.shop.vn/webhook/don-moi",
        )
    })

    it("never shows the query, the fragment or a user and password", async () => {
        const policy = await build()
        const url = new URL("https://user:pass@hook.test:8443/events?token=abc123#frag")
        expect(policy.maskedWebhookUrl(url)).toBe("https://hook.test:8443/events")
    })

    it("cuts a path segment that looks like a token", async () => {
        const policy = await build()
        expect(policy.maskedWebhookUrl(new URL("https://hook.eu2.make.com/8x2kq9w4p7r1m5z3n6v0c8b2"))).toBe(
            "https://hook.eu2.make.com/8x2k...",
        )
    })

    it("shows the bare host for the root path", async () => {
        const policy = await build()
        expect(policy.maskedWebhookUrl(new URL("https://hook.test/"))).toBe("https://hook.test")
    })
})
