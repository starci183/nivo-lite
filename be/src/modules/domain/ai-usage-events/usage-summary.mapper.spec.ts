import { Test } from "@nestjs/testing"
import {
    toDailyModuleUsage as realToDailyModuleUsage,
    toUsageSummary as realToUsageSummary,
} from "./usage-summary.mapper"

const SUBJECT = Symbol("usage-summary.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { toDailyModuleUsage: realToDailyModuleUsage, toUsageSummary: realToUsageSummary },
            },
        ],
    }).compile()
    return moduleRef.get<{
        toDailyModuleUsage: typeof realToDailyModuleUsage
        toUsageSummary: typeof realToUsageSummary
    }>(SUBJECT)
}

describe("usage summary mapper", () => {
    it("maps the database daily row", async () => {
        const subject = await build()

        expect(
            subject.toDailyModuleUsage({
                day: "2026-10-02",
                module: "sales",
                calls: 2,
                tokens: 40,
                cost_usd: 0.00113,
            }),
        ).toEqual({ day: "2026-10-02", module: "sales", calls: 2, tokens: 40, costUsd: 0.00113 })
    })

    it("returns empty groups when the workspace has no usage or quota", async () => {
        const subject = await build()

        expect(subject.toUsageSummary(null, [])).toEqual({ status: null, byModule: [], daily: [] })
    })

    it("adds repeated module and day rollups, sorts modules by credits and days chronologically", async () => {
        const subject = await build()

        expect(
            subject.toUsageSummary(null, [
                { day: "2026-10-02", module: "sales", calls: 1, tokens: 10, costUsd: 0.00113 },
                { day: "2026-10-01", module: "office", calls: 2, tokens: 20, costUsd: 0.00339 },
                { day: "2026-10-02", module: "sales", calls: 3, tokens: 30, costUsd: 0.00113 },
                { day: "2026-10-01", module: "sales", calls: 4, tokens: 40, costUsd: 0 },
            ]),
        ).toEqual({
            status: null,
            byModule: [
                { module: "office", calls: 2, tokens: 20, costUsd: 0.00339, credits: 3 },
                { module: "sales", calls: 8, tokens: 80, costUsd: 0.00226, credits: 2 },
            ],
            daily: [
                { day: "2026-10-01", tokens: 60, credits: 3 },
                { day: "2026-10-02", tokens: 40, credits: 2 },
            ],
        })
    })
})
