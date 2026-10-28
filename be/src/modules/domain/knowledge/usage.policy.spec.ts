import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { AiPoolUsage } from "@modules/integrations/ai-pool"
import type { QuotaStatus } from "./knowledge.contracts"
import type { QuotaStatusRow } from "./persistence/usage.rows"
import { estimateTokens, figuresOf, isBlocked, priceOf, quotaStatusOf } from "./usage.policy"

const SUBJECT = Symbol("usage.policy")
type Subject = {
    priceOf: typeof priceOf
    estimateTokens: typeof estimateTokens
    figuresOf: typeof figuresOf
    quotaStatusOf: typeof quotaStatusOf
    isBlocked: typeof isBlocked
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { priceOf, estimateTokens, figuresOf, quotaStatusOf, isBlocked } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const usageOf = builder<AiPoolUsage>({ promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null })

const rowOf = builder<QuotaStatusRow>({
    period_start: "2026-10-01",
    messages_used: 0,
    tokens_used: 0,
    cost_usd: 0,
    messages_limit: null,
    tokens_limit: null,
    credits_used: null,
    credits_limit: null,
    topup_balance: null,
})

const statusOf = builder<QuotaStatus>({
    periodStart: "2026-10-01",
    messagesUsed: 0,
    tokensUsed: 0,
    messagesLimit: null,
    tokensLimit: null,
    creditsUsed: 0,
    creditsLimit: null,
    topupBalance: 0,
    messagesExceeded: false,
    tokensExceeded: false,
    creditsExceeded: false,
    ratio: 0,
    level: "ok",
})

describe("priceOf", () => {
    it("prices a model by its list price and any other model by the default", async () => {
        const subject = await build()

        expect(subject.priceOf("deepseek/deepseek-chat", 1_000_000, 1_000_000)).toBeCloseTo(0.42)
        expect(subject.priceOf("qwen/qwen3-embedding-8b", 1_000_000, 0)).toBeCloseTo(0.01)
        expect(subject.priceOf("other/model", 1_000_000, 1_000_000)).toBeCloseTo(1.5)
    })
})

describe("estimateTokens", () => {
    it("counts about one token per three characters, at least one", async () => {
        const subject = await build()

        expect(subject.estimateTokens(0)).toBe(1)
        expect(subject.estimateTokens(10)).toBe(4)
    })
})

describe("figuresOf", () => {
    const base = { model: "deepseek/x", promptChars: 30, completionChars: 0 }

    it("estimates from the characters when the provider reported nothing", async () => {
        const subject = await build()

        expect(subject.figuresOf({ ...base, usage: null })).toEqual({
            promptTokens: 10,
            completionTokens: 0,
            costUsd: subject.priceOf("deepseek/x", 10, 0),
            estimated: true,
        })
        expect(subject.figuresOf({ ...base, completionChars: 9, usage: usageOf() })).toMatchObject({
            promptTokens: 10,
            completionTokens: 3,
            estimated: true,
        })
    })

    it("takes the tokens and the cost the provider reported", async () => {
        const subject = await build()

        expect(
            subject.figuresOf({ ...base, usage: usageOf({ promptTokens: 5, completionTokens: 7, costUsd: 0.5 }) }),
        ).toEqual({
            promptTokens: 5,
            completionTokens: 7,
            costUsd: 0.5,
            estimated: false,
        })
    })

    it("derives a missing side from the total and prices the call when no cost was reported", async () => {
        const subject = await build()

        expect(subject.figuresOf({ ...base, usage: usageOf({ totalTokens: 12 }) })).toMatchObject({
            promptTokens: 12,
            completionTokens: 0,
            costUsd: subject.priceOf("deepseek/x", 12, 0),
        })
        expect(subject.figuresOf({ ...base, usage: usageOf({ completionTokens: 4, totalTokens: 12 }) })).toMatchObject({
            promptTokens: 8,
            completionTokens: 4,
        })
        expect(subject.figuresOf({ ...base, usage: usageOf({ promptTokens: 5, totalTokens: 12 }) })).toMatchObject({
            promptTokens: 5,
            completionTokens: 7,
        })
        expect(subject.figuresOf({ ...base, usage: usageOf({ promptTokens: 5 }) })).toMatchObject({
            promptTokens: 5,
            completionTokens: 0,
        })
    })
})

describe("quotaStatusOf", () => {
    it("is ok and unlimited when there are no allowances, and derives credits from the cost", async () => {
        const subject = await build()

        expect(subject.quotaStatusOf(rowOf({ cost_usd: "0.2" }))).toEqual(statusOf({ creditsUsed: 177 }))
    })

    it("reads the numbers PostgreSQL sends as text", async () => {
        const subject = await build()

        expect(
            subject.quotaStatusOf(
                rowOf({
                    messages_used: "3",
                    tokens_used: "40",
                    messages_limit: "10",
                    tokens_limit: "100",
                    credits_used: "10",
                    credits_limit: "100",
                    topup_balance: "5",
                }),
            ),
        ).toMatchObject({
            messagesUsed: 3,
            tokensUsed: 40,
            messagesLimit: 10,
            tokensLimit: 100,
            creditsUsed: 10,
            topupBalance: 5,
        })
    })

    it("warns at 80 percent of an allowance", async () => {
        const subject = await build()

        expect(subject.quotaStatusOf(rowOf({ tokens_used: 80, tokens_limit: 100 }))).toMatchObject({
            level: "warn",
            ratio: 0.8,
            tokensExceeded: false,
        })
    })
})

describe("quotaStatusOf", () => {
    it("exceeds the quota when replies or tokens reach their allowance, including zero", async () => {
        const subject = await build()

        expect(subject.quotaStatusOf(rowOf({ messages_used: 10, messages_limit: 10 }))).toMatchObject({
            level: "exceeded",
            messagesExceeded: true,
        })
        expect(subject.quotaStatusOf(rowOf({ tokens_used: 0, tokens_limit: 0 }))).toMatchObject({
            level: "exceeded",
            tokensExceeded: true,
            ratio: 1,
        })
    })

    it("is exceeded on credits only when the top-ups are gone too", async () => {
        const subject = await build()

        expect(subject.quotaStatusOf(rowOf({ credits_used: 100, credits_limit: 100, topup_balance: 0 }))).toMatchObject(
            {
                creditsExceeded: true,
                level: "exceeded",
            },
        )
        expect(
            subject.quotaStatusOf(rowOf({ credits_used: 100, credits_limit: 100, topup_balance: 50 })),
        ).toMatchObject({
            creditsExceeded: false,
        })
    })

    it("takes an empty credit pool as used up and never reads a negative top-up", async () => {
        const subject = await build()

        expect(subject.quotaStatusOf(rowOf({ credits_used: 0, credits_limit: 0, topup_balance: -5 }))).toMatchObject({
            ratio: 1,
            topupBalance: 0,
        })
    })
})

describe("isBlocked", () => {
    const exceeded = statusOf({ level: "exceeded" })
    const tokens = statusOf({ tokensExceeded: true })
    const credits = statusOf({ creditsExceeded: true })

    it("never blocks a guide call and a small embedding", async () => {
        const subject = await build()

        expect(subject.isBlocked("guide", exceeded, true)).toBe(false)
        expect(subject.isBlocked("embedding", exceeded, false)).toBe(false)
    })

    it("blocks a bulk embedding and a brain call on exhausted tokens or credits", async () => {
        const subject = await build()

        expect(subject.isBlocked("embedding", tokens, true)).toBe(true)
        expect(subject.isBlocked("brain", credits, false)).toBe(true)
        expect(subject.isBlocked("brain", statusOf(), false)).toBe(false)
    })

    it("holds back a customer reply as soon as the allowance is exceeded", async () => {
        const subject = await build()

        expect(subject.isBlocked("chat_reply", exceeded, false)).toBe(true)
        expect(subject.isBlocked("relay", statusOf({ level: "warn" }), false)).toBe(false)
    })
})
