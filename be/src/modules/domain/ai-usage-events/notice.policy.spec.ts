import { Test } from "@nestjs/testing"
import type { QuotaStatus } from "./ai-usage-events.contracts"
import {
    noticeLevelOf as realNoticeLevelOf,
    noticeUseOf as realNoticeUseOf,
    usageNoticeKeyOf as realUsageNoticeKeyOf,
} from "./notice.policy"

const SUBJECT = Symbol("notice.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    noticeUseOf: realNoticeUseOf,
                    noticeLevelOf: realNoticeLevelOf,
                    usageNoticeKeyOf: realUsageNoticeKeyOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        noticeUseOf: typeof realNoticeUseOf
        noticeLevelOf: typeof realNoticeLevelOf
        usageNoticeKeyOf: typeof realUsageNoticeKeyOf
    }>(SUBJECT)
}

const status: QuotaStatus = {
    periodStart: "2026-10-01",
    messagesUsed: 987,
    tokensUsed: 12_345,
    costUsd: 4.9384,
    messagesLimit: 1_234,
    tokensLimit: 98_765,
    fallbackReply: null,
    creditsUsed: 1_234.6,
    creditsLimit: 2_500,
    creditsCarried: 0,
    topupBalance: 12.5,
    messagesExceeded: false,
    tokensExceeded: false,
    creditsExceeded: false,
    ratio: 0.804,
    level: "warn",
}

describe("notice policy", () => {
    describe("noticeUseOf", () => {
        it("prints the use with Vietnamese numbers, rounded credit use and the top-up left", async () => {
            const { noticeUseOf } = await build()

            expect(noticeUseOf(status)).toBe(
                "1.235/2.500 credit, 12,5 credit n\u1ea1p th\u00eam c\u00f2n l\u1ea1i, 987/1.234 tin nh\u1eafn, 12.345/98.765 token",
            )
        })

        it("leaves unlimited allowances and empty top-ups out", async () => {
            const { noticeUseOf } = await build()

            expect(
                noticeUseOf({ ...status, creditsLimit: null, messagesLimit: null, tokensLimit: null, topupBalance: 0 }),
            ).toBe("")
        })

        it("joins only the applicable allowance without an empty separator", async () => {
            const { noticeUseOf } = await build()

            expect(noticeUseOf({ ...status, creditsLimit: null, tokensLimit: null, topupBalance: -1 })).toBe(
                "987/1.234 tin nh\u1eafn",
            )
        })
    })

    describe("usageNoticeKeyOf", () => {
        it("is one key per month and level, so a repeat is the same line", async () => {
            const { usageNoticeKeyOf } = await build()

            expect(usageNoticeKeyOf("2026-10-01", "warn")).toBe("usage-notice:warn:2026-10-01")
            expect(usageNoticeKeyOf("2026-10-01", "warn")).toBe(usageNoticeKeyOf("2026-10-01", "warn"))
            expect(usageNoticeKeyOf("2026-10-01", "exceeded")).not.toBe(usageNoticeKeyOf("2026-10-01", "warn"))
            expect(usageNoticeKeyOf("2026-11-01", "warn")).not.toBe(usageNoticeKeyOf("2026-10-01", "warn"))
        })
    })

    describe("noticeLevelOf", () => {
        it("returns no notice for an ok quota", async () => {
            const { noticeLevelOf } = await build()

            expect(noticeLevelOf({ ...status, level: "ok" })).toBeNull()
        })

        it("returns the warning or exceeded level to announce", async () => {
            const { noticeLevelOf } = await build()

            expect(noticeLevelOf(status)).toBe("warn")
            expect(noticeLevelOf({ ...status, level: "exceeded" })).toBe("exceeded")
        })
    })
})
