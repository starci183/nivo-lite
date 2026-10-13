import { isLocalOnly, publicSiteUrl, webhookUrlFor } from "./connection-url.policy"

describe("connection url policy", () => {
    describe("publicSiteUrl", () => {
        it("answers the origin of a public https site", () => {
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
        ])("answers null for %s", (_label, value) => {
            expect(publicSiteUrl(value)).toBeNull()
        })
    })

    describe("isLocalOnly", () => {
        it("tells a reachable site from a local one", () => {
            expect(isLocalOnly("https://app.example.com")).toBe(false)
            expect(isLocalOnly(undefined)).toBe(true)
        })
    })

    describe("webhookUrlFor", () => {
        it("builds each provider path from the site url without a trailing slash", () => {
            const site = "https://app.example.com/"

            expect(webhookUrlFor("telegram", "c1", site)).toBe("https://app.example.com/api/telegram/c1")
            expect(webhookUrlFor("zalo_oa", "c1", site)).toBe("https://app.example.com/api/connections/zalo/c1")
            expect(webhookUrlFor("sepay", "c1", site)).toBe("https://app.example.com/api/connections/sepay/c1")
            expect(webhookUrlFor("meta", "c1", site)).toBe("https://app.example.com/api/connections/meta/webhook")
        })

        it("falls back to the local origin when the site url is unset", () => {
            expect(webhookUrlFor("casso", "c1", undefined)).toBe("http://localhost:3100/api/connections/casso/c1")
        })
    })
})
