import { Test } from "@nestjs/testing"
import {
    isLocalOnly as realIsLocalOnly,
    publicSiteUrl as realPublicSiteUrl,
    webhookUrlFor as realWebhookUrlFor,
} from "./connection-url.policy"

const SUBJECT = Symbol("connection-url.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isLocalOnly: realIsLocalOnly,
                    publicSiteUrl: realPublicSiteUrl,
                    webhookUrlFor: realWebhookUrlFor,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<{
        isLocalOnly: typeof realIsLocalOnly
        publicSiteUrl: typeof realPublicSiteUrl
        webhookUrlFor: typeof realWebhookUrlFor
    }>(SUBJECT)
    const isLocalOnly = subject.isLocalOnly
    const publicSiteUrl = subject.publicSiteUrl
    const webhookUrlFor = subject.webhookUrlFor
    return { isLocalOnly, publicSiteUrl, webhookUrlFor }
}

describe("connection url policy", () => {
    describe("publicSiteUrl", () => {
        it("answers the origin of a public https site", async () => {
            const { publicSiteUrl } = await buildSubject()

            expect(publicSiteUrl("https://app.example.com/some/path")).toBe("https://app.example.com")
        })

        it.each([
            ["unset", undefined],
            ["not a url", "nonsense"],
            ["plain http", "http://app.example.com"],
            ["localhost", "https://localhost"],
            ["a .localhost name", "https://app.localhost"],
            ["loopback", "https://127.0.0.1"],
            ["ipv6 loopback", "https://[::1]"],
        ])("answers null for %s", async (_label, value) => {
            const { publicSiteUrl } = await buildSubject()

            expect(publicSiteUrl(value)).toBeNull()
        })
    })

    describe("isLocalOnly", () => {
        it("tells a reachable site from a local one", async () => {
            const { isLocalOnly } = await buildSubject()

            expect(isLocalOnly("https://app.example.com")).toBe(false)
            expect(isLocalOnly(undefined)).toBe(true)
        })
    })

    describe("webhookUrlFor", () => {
        it("builds each provider path from the site url without a trailing slash", async () => {
            const { webhookUrlFor } = await buildSubject()

            const site = "https://app.example.com/"

            expect(webhookUrlFor("telegram", "c1", site)).toBe("https://app.example.com/api/telegram/c1")
            expect(webhookUrlFor("zalo_oa", "c1", site)).toBe("https://app.example.com/api/connections/zalo/c1")
            expect(webhookUrlFor("sepay", "c1", site)).toBe("https://app.example.com/api/connections/sepay/c1")
            expect(webhookUrlFor("meta", "c1", site)).toBe("https://app.example.com/api/connections/meta/webhook")
        })

        it("builds the webhook address from the configured site", async () => {
            const { webhookUrlFor } = await buildSubject()

            expect(webhookUrlFor("casso", "c1", "https://site.example.com")).toBe(
                "https://site.example.com/api/connections/casso/c1",
            )
        })
    })
})
