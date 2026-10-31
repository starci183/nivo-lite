import { Test } from "@nestjs/testing"
import type { QuotaFigures, QuotaRecord, QuotaStatus, UsageKind } from "./ai-usage-events.contracts"
import {
    quotaFiguresOf as realQuotaFiguresOf,
    quotaLookupOf as realQuotaLookupOf,
    quotaOf as realQuotaOf,
    stopsCall as realStopsCall,
    WARN_AT,
} from "./quota.policy"

const SUBJECT = Symbol("quota.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    quotaFiguresOf: realQuotaFiguresOf,
                    quotaLookupOf: realQuotaLookupOf,
                    quotaOf: realQuotaOf,
                    stopsCall: realStopsCall,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        quotaFiguresOf: typeof realQuotaFiguresOf
        quotaLookupOf: typeof realQuotaLookupOf
        quotaOf: typeof realQuotaOf
        stopsCall: typeof realStopsCall
    }>(SUBJECT)
}

const row: QuotaFigures = {
    period_start: "2026-10-01",
    messages_used: 500,
    tokens_used: 2_000,
    cost_usd: 0.6,
    messages_limit: 1_000,
    tokens_limit: 10_000,
    fallback_reply: "  Please wait for a colleague.  ",
    credits_used: 100,
    credits_limit: 500,
    credits_carried: 40,
    topup_balance: 0,
}

const status: QuotaStatus = {
    periodStart: "2026-10-01",
    messagesUsed: 500,
    tokensUsed: 2_000,
    costUsd: 0.6,
    messagesLimit: 1_000,
    tokensLimit: 10_000,
    fallbackReply: "Please wait for a colleague.",
    creditsUsed: 100,
    creditsLimit: 500,
    creditsCarried: 40,
    topupBalance: 0,
    messagesExceeded: false,
    tokensExceeded: false,
    creditsExceeded: false,
    ratio: 0.5,
    level: "ok",
}

describe("quota policy > quotaOf", () => {
    it("maps the usage and allowances and trims the fallback reply", async () => {
        const subject = await build()

        expect(WARN_AT).toBe(0.8)
        expect(subject.quotaOf(row)).toEqual(status)
    })

    it("uses model cost for missing credits and defaults missing balances with unlimited allowances", async () => {
        const subject = await build()

        expect(
            subject.quotaOf({
                ...row,
                messages_limit: null,
                tokens_limit: null,
                credits_limit: null,
                credits_used: null,
                credits_carried: null,
                topup_balance: null,
                fallback_reply: null,
            }),
        ).toEqual({
            ...status,
            messagesLimit: null,
            tokensLimit: null,
            creditsLimit: null,
            creditsUsed: 531,
            creditsCarried: 0,
            fallbackReply: null,
            ratio: 0,
        })
    })

    it("warns at exactly eighty percent of the largest allowance", async () => {
        const subject = await build()

        expect(subject.quotaOf({ ...row, messages_used: 800, tokens_used: 7_900, credits_used: 395 })).toEqual({
            ...status,
            messagesUsed: 800,
            tokensUsed: 7_900,
            creditsUsed: 395,
            ratio: 0.8,
            level: "warn",
        })
    })
})

describe("quota policy > quotaOf", () => {
    it("marks an exhausted message allowance as exceeded", async () => {
        const subject = await build()

        expect(subject.quotaOf({ ...row, messages_used: 1_000 })).toEqual({
            ...status,
            messagesUsed: 1_000,
            messagesExceeded: true,
            ratio: 1,
            level: "exceeded",
        })
    })

    it("marks an exhausted token allowance as exceeded", async () => {
        const subject = await build()

        expect(subject.quotaOf({ ...row, tokens_used: 10_000 })).toEqual({
            ...status,
            tokensUsed: 10_000,
            tokensExceeded: true,
            ratio: 1,
            level: "exceeded",
        })
    })

    it("marks credits as exhausted once the allowance has no remaining top-up", async () => {
        const subject = await build()

        expect(subject.quotaOf({ ...row, credits_used: 500, topup_balance: -40, fallback_reply: "  " })).toEqual({
            ...status,
            creditsUsed: 500,
            fallbackReply: null,
            creditsExceeded: true,
            ratio: 1,
            level: "exceeded",
        })
    })
})

describe("quota policy > quotaOf", () => {
    it("uses the spent allowance and remaining top-ups as one pool after passing the allowance", async () => {
        const subject = await build()

        expect(subject.quotaOf({ ...row, credits_used: 600, topup_balance: 150 })).toEqual({
            ...status,
            creditsUsed: 600,
            topupBalance: 150,
            ratio: 0.8,
            level: "warn",
        })
    })

    it("uses the full allowance and remaining top-ups as one pool before passing the allowance", async () => {
        const subject = await build()

        expect(subject.quotaOf({ ...row, messages_used: 0, credits_used: 400, topup_balance: 300 })).toEqual({
            ...status,
            messagesUsed: 0,
            creditsUsed: 400,
            topupBalance: 300,
        })
    })

    it("treats zero message and negative token limits as exhausted", async () => {
        const subject = await build()

        expect(
            subject.quotaOf({ ...row, messages_used: 0, tokens_used: 0, messages_limit: 0, tokens_limit: -1 }),
        ).toEqual({
            ...status,
            messagesUsed: 0,
            tokensUsed: 0,
            messagesLimit: 0,
            tokensLimit: -1,
            messagesExceeded: true,
            tokensExceeded: true,
            ratio: 1,
            level: "exceeded",
        })
    })
})

describe("quota policy > quotaOf", () => {
    it("treats an empty credit pool as exhausted", async () => {
        const subject = await build()

        expect(subject.quotaOf({ ...row, credits_used: 0, credits_limit: 0 })).toEqual({
            ...status,
            creditsUsed: 0,
            creditsLimit: 0,
            creditsExceeded: true,
            ratio: 1,
            level: "exceeded",
        })
    })
})

describe("quota policy > quotaLookupOf", () => {
    it("returns null when there is no quota row", async () => {
        const subject = await build()

        expect(subject.quotaLookupOf([])).toBeNull()
    })

    it("maps the first quota row", async () => {
        const subject = await build()

        expect(subject.quotaLookupOf([row, { ...row, messages_used: 1_000 }])).toEqual(status)
    })
})

describe("quota policy > stopsCall", () => {
    it.each<UsageKind>(["chat_reply", "relay"])("stops %s at any exhausted allowance", async (kind) => {
        const subject = await build()

        expect(subject.stopsCall({ ...status, messagesExceeded: true, level: "exceeded" }, kind)).toBe(true)
        expect(subject.stopsCall({ ...status, level: "warn" }, kind)).toBe(false)
        expect(subject.stopsCall(status, kind)).toBe(false)
    })

    it.each<UsageKind>([
        "setup",
        "owner_chat",
        "embedding",
        "engine",
        "guide",
        "brain",
        "office_command",
        "agent_work",
    ])("stops %s at tokens or credits, and lets it pass a message allowance", async (kind) => {
        const subject = await build()

        expect(subject.stopsCall({ ...status, messagesExceeded: true, level: "exceeded" }, kind)).toBe(false)
        expect(subject.stopsCall({ ...status, tokensExceeded: true, level: "exceeded" }, kind)).toBe(true)
        expect(subject.stopsCall({ ...status, creditsExceeded: true, level: "exceeded" }, kind)).toBe(true)
    })
})

const record: QuotaRecord = {
    period_start: "2026-10-01T00:00:00.000Z",
    messages_used: "500",
    tokens_used: "2000",
    cost_usd: "0.6",
    messages_limit: "1000",
    tokens_limit: null,
    fallback_reply: "Wait",
    credits_used: "100",
    credits_limit: null,
    credits_carried: "40",
    topup_balance: "5",
}

describe("quota policy > quotaFiguresOf", () => {
    it("reads a text date and numeric text into figures, keeping null allowances", async () => {
        const subject = await build()

        expect(subject.quotaFiguresOf(record)).toEqual({
            period_start: "2026-10-01",
            messages_used: 500,
            tokens_used: 2_000,
            cost_usd: 0.6,
            messages_limit: 1_000,
            tokens_limit: null,
            fallback_reply: "Wait",
            credits_used: 100,
            credits_limit: null,
            credits_carried: 40,
            topup_balance: 5,
        })
    })

    it("reads a local date into a padded period", async () => {
        const subject = await build()

        expect(subject.quotaFiguresOf({ ...record, period_start: new Date(2026, 0, 5) }).period_start).toBe(
            "2026-01-05",
        )
    })
})
