import { Test } from "@nestjs/testing"
import type { TestingModule } from "@nestjs/testing"
import { refusalOfText } from "./webhook-target.policy"

const WEBHOOK_TARGET_POLICY = Symbol("WEBHOOK_TARGET_POLICY")
type WebhookTargetPolicy = { refusalOfText: typeof refusalOfText }

describe("webhook target policy", () => {
    let moduleRef: TestingModule
    let policy: WebhookTargetPolicy

    beforeAll(async () => {
        moduleRef = await Test.createTestingModule({
            providers: [{ provide: WEBHOOK_TARGET_POLICY, useValue: { refusalOfText } }],
        }).compile()
        policy = moduleRef.get<WebhookTargetPolicy>(WEBHOOK_TARGET_POLICY)
    })

    afterAll(async () => {
        await moduleRef.close()
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
