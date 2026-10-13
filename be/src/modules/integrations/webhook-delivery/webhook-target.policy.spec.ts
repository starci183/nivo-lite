import { Test } from "@nestjs/testing"
import type { TestingModule } from "@nestjs/testing"
import { isPrivateAddress, refusalOfText } from "./webhook-target.policy"

const WEBHOOK_TARGET_POLICY = Symbol("WEBHOOK_TARGET_POLICY")
type WebhookTargetPolicy = { isPrivateAddress: typeof isPrivateAddress; refusalOfText: typeof refusalOfText }

describe("webhook target policy", () => {
    let moduleRef: TestingModule
    let policy: WebhookTargetPolicy

    beforeAll(async () => {
        moduleRef = await Test.createTestingModule({
            providers: [{ provide: WEBHOOK_TARGET_POLICY, useValue: { isPrivateAddress, refusalOfText } }],
        }).compile()
        policy = moduleRef.get<WebhookTargetPolicy>(WEBHOOK_TARGET_POLICY)
    })

    afterAll(async () => {
        await moduleRef.close()
    })

    describe("isPrivateAddress", () => {
        it.each([
            ["0.0.0.0", true],
            ["0.8.8.8", true],
            ["10.0.0.1", true],
            ["127.0.0.1", true],
            ["169.253.0.1", false],
            ["169.254.0.1", true],
            ["169.255.0.1", false],
            ["172.15.0.1", false],
            ["172.16.0.1", true],
            ["172.31.255.255", true],
            ["172.32.0.1", false],
            ["192.167.0.1", false],
            ["192.168.0.1", true],
            ["192.169.0.1", false],
            ["100.63.255.255", false],
            ["100.64.0.1", true],
            ["100.127.255.255", true],
            ["100.128.0.1", false],
            ["8.8.8.8", false],
        ])("classifies IPv4 address %s as private=%s", (address, expected) => {
            expect(policy.isPrivateAddress(address)).toBe(expected)
        })

        it.each([
            ["::1", true],
            ["::", true],
            ["[::1]", true],
            ["FC00::1", true],
            ["fd00::1", true],
            ["fe80::1", true],
            ["fe90::1", true],
            ["fea0::1", true],
            ["feb0::1", true],
            ["fe70::1", false],
            ["fec0::1", false],
            ["2001:4860:4860::8888", false],
            ["::ffff:10.0.0.1", true],
            ["[::FFFF:192.168.0.1]", true],
            ["::ffff:8.8.8.8", false],
        ])("classifies IPv6 address %s as private=%s", (address, expected) => {
            expect(policy.isPrivateAddress(address)).toBe(expected)
        })

        it.each(["", "not-an-address", "8.8.8", "8.8.8.8.8", "8.8.8.nope", "8.8.8.Infinity"])(
            "refuses the malformed address %s as private",
            (address) => {
                expect(policy.isPrivateAddress(address)).toBe(true)
            },
        )
    })

    describe("refusalOfText", () => {
        it.each(["", "  not-a-url  ", "https://"])("refuses an unparseable target %s", (raw) => {
            expect(policy.refusalOfText(raw)).toEqual({ reason: "url" })
        })

        it.each(["ftp://example.com/hook", "mailto:owner@example.com"])(
            "refuses the unsupported target scheme %s",
            (raw) => {
                expect(policy.refusalOfText(raw)).toEqual({ reason: "scheme" })
            },
        )

        it.each([
            "https://owner@example.com/hook",
            "https://:password@example.com/hook",
            "https://owner:password@example.com/hook",
        ])("refuses embedded credentials in %s", (raw) => {
            expect(policy.refusalOfText(raw)).toEqual({ reason: "credentials" })
        })

        it.each([
            ["  http://example.com/hook?event=paid  ", "http://example.com/hook?event=paid"],
            ["\t HTTPS://EXAMPLE.COM:443/hook#event \n", "https://example.com/hook#event"],
        ])("returns the trimmed, parsed http(s) target %s", (raw, expected) => {
            expect(policy.refusalOfText(raw)).toEqual({ url: new URL(expected) })
        })
    })
})
