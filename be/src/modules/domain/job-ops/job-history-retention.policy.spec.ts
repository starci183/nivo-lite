import { Test } from "@nestjs/testing"
import { DEFAULT_RETENTION_WINDOW, retentionWindowOf as policy } from "./job-history-retention.policy"

const SUBJECT = Symbol("job-history-retention.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: policy }],
    }).compile()
    return moduleRef.get<typeof policy>(SUBJECT)
}

describe("retentionWindowOf", () => {
    it("defaults to one day of successes, seven days of failures and 5000 rows per statement", async () => {
        const retentionWindowOf = await buildSubject()
        expect(retentionWindowOf({})).toEqual({ doneDays: 1, failedDays: 7, batch: 5000 })
        expect(retentionWindowOf(null)).toEqual(DEFAULT_RETENTION_WINDOW)
        expect(retentionWindowOf("text")).toEqual(DEFAULT_RETENTION_WINDOW)
    })

    it("takes the window the tick payload carries", async () => {
        const retentionWindowOf = await buildSubject()
        expect(retentionWindowOf({ doneDays: 2, failedDays: 14, batch: 1000 })).toEqual({
            doneDays: 2,
            failedDays: 14,
            batch: 1000,
        })
    })

    it.each([
        { doneDays: -1 },
        { doneDays: 1.5 },
        { doneDays: "3" },
        { doneDays: 99_999 },
        { batch: 0 },
        { batch: 20_001 },
        { batch: Number.NaN },
    ])("replaces the invalid member %j by its default", async (payload) => {
        const retentionWindowOf = await buildSubject()
        expect(retentionWindowOf(payload)).toEqual(DEFAULT_RETENTION_WINDOW)
    })

    it("never keeps a failure for a shorter time than a success", async () => {
        const retentionWindowOf = await buildSubject()
        expect(retentionWindowOf({ doneDays: 10, failedDays: 3 })).toEqual({
            doneDays: 10,
            failedDays: 10,
            batch: 5000,
        })
    })
})
