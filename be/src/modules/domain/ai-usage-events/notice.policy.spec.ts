import { Test } from "@nestjs/testing"
import type { QuotaStatus } from "./ai-usage-events.contracts"
import { noticeBody as realNoticeBody, noticeLevelOf as realNoticeLevelOf } from "./notice.policy"

const SUBJECT = Symbol("notice.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { noticeBody: realNoticeBody, noticeLevelOf: realNoticeLevelOf } }],
    }).compile()
    const subject = moduleRef.get<{ noticeBody: typeof realNoticeBody; noticeLevelOf: typeof realNoticeLevelOf }>(
        SUBJECT,
    )
    return subject
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
    describe("noticeBody", () => {
        it("prints the warning with Vietnamese numbers and the rounded percentage and credit use", async () => {
            const { noticeBody } = await build()

            expect(noticeBody("warn", status)).toBe(
                "M\u1ee9c d\u00f9ng AI th\u00e1ng n\u00e0y \u0111\u00e3 \u0111\u1ea1t 80% h\u1ea1n m\u1ee9c (1.235/2.500 credit, 12,5 credit n\u1ea1p th\u00eam " +
                    "c\u00f2n l\u1ea1i, 987/1.234 tin nh\u1eafn, 12.345/98.765 token). Khi h\u1ebft h\u1ea1n m\u1ee9c, chatbot s\u1ebd chuy\u1ec3n " +
                    "c\u00e2u h\u1ecfi c\u1ee7a kh\u00e1ch cho nh\u00e2n vi\u00ean thay v\u00ec t\u1ef1 tr\u1ea3 l\u1eddi. N\u1ea1p th\u00eam credit ho\u1eb7c n\u00e2ng c\u1ea5p g\u00f3i " +
                    "t\u1ea1i Credit & g\u00f3i (/billing).",
            )
        })

        it("prints the exhausted notice and leaves unlimited allowances and empty top-ups out", async () => {
            const { noticeBody } = await build()

            expect(
                noticeBody("exceeded", {
                    ...status,
                    creditsLimit: null,
                    messagesLimit: null,
                    tokensLimit: null,
                    topupBalance: 0,
                    level: "exceeded",
                }),
            ).toBe(
                "Workspace \u0111\u00e3 d\u00f9ng h\u1ebft h\u1ea1n m\u1ee9c AI c\u1ee7a th\u00e1ng n\u00e0y (). Chatbot t\u1ea1m d\u1eebng t\u1ef1 tr\u1ea3 l\u1eddi: kh\u00e1ch " +
                    "nh\u1eadn l\u1eddi x\u00e1c nh\u1eadn l\u1ecbch s\u1ef1 v\u00e0 c\u00e2u h\u1ecfi \u0111\u01b0\u1ee3c chuy\u1ec3n cho nh\u00e2n vi\u00ean. N\u1ea1p th\u00eam credit ho\u1eb7c " +
                    "n\u00e2ng c\u1ea5p g\u00f3i t\u1ea1i Credit & g\u00f3i (/billing) \u0111\u1ec3 chatbot ho\u1ea1t \u0111\u1ed9ng l\u1ea1i.",
            )
        })

        it("joins only the applicable allowance without an empty separator", async () => {
            const { noticeBody } = await build()

            expect(
                noticeBody("warn", {
                    ...status,
                    creditsLimit: null,
                    tokensLimit: null,
                    topupBalance: -1,
                }),
            ).toBe(
                "M\u1ee9c d\u00f9ng AI th\u00e1ng n\u00e0y \u0111\u00e3 \u0111\u1ea1t 80% h\u1ea1n m\u1ee9c (987/1.234 tin nh\u1eafn). Khi h\u1ebft h\u1ea1n m\u1ee9c, " +
                    "chatbot s\u1ebd chuy\u1ec3n c\u00e2u h\u1ecfi c\u1ee7a kh\u00e1ch cho nh\u00e2n vi\u00ean thay v\u00ec t\u1ef1 tr\u1ea3 l\u1eddi. N\u1ea1p th\u00eam credit " +
                    "ho\u1eb7c n\u00e2ng c\u1ea5p g\u00f3i t\u1ea1i Credit & g\u00f3i (/billing).",
            )
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
