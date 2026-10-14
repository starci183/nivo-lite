import { builder } from "@starci/jest-preset"
import { campaignSegmentOf, loyaltyCampaignOf } from "./loyalty-campaigns.mapper"
import type { LoyaltyCampaignRow } from "./persistence/loyalty-campaigns.rows"

const rowOf = builder<LoyaltyCampaignRow>({
    id: "campaign-1",
    name: "Autumn",
    segment: { tiers: ["silver"], inactiveDays: 30, birthdayThisMonth: true, minSpendVnd: 500_000 },
    draft: "Hello {ten_khach}",
    status: "draft",
    work_item_id: "decision-1",
    recipients: 10,
    sent: 3,
    queued: 4,
    failed: 2,
    skipped: 1,
    draft_ms: 450,
    created_by: "Owner",
    created_at: new Date("2026-10-12T00:00:00.000Z"),
    finished_at: null,
})

describe("loyalty-campaigns.mapper", () => {
    describe("campaignSegmentOf", () => {
        it.each([null, undefined, "legacy", 7])(
            "uses every customer for a missing or non-record segment %p",
            (value) => {
                expect(campaignSegmentOf(value)).toEqual({
                    tiers: [],
                    inactiveDays: 0,
                    birthdayThisMonth: false,
                    minSpendVnd: 0,
                })
            },
        )

        it("keeps string tiers and finite nonnegative conditions", () => {
            expect(
                campaignSegmentOf({
                    tiers: ["silver", null, 3, "gold"],
                    inactiveDays: 30,
                    birthdayThisMonth: true,
                    minSpendVnd: 500_000,
                }),
            ).toEqual({ tiers: ["silver", "gold"], inactiveDays: 30, birthdayThisMonth: true, minSpendVnd: 500_000 })
        })

        it("discards invalid conditions and clamps negative values to zero", () => {
            expect(
                campaignSegmentOf({
                    tiers: "silver",
                    inactiveDays: Number.NaN,
                    birthdayThisMonth: "true",
                    minSpendVnd: -1,
                }),
            ).toEqual({ tiers: [], inactiveDays: 0, birthdayThisMonth: false, minSpendVnd: 0 })
            expect(campaignSegmentOf({ inactiveDays: "30", minSpendVnd: Number.POSITIVE_INFINITY })).toEqual({
                tiers: [],
                inactiveDays: 0,
                birthdayThisMonth: false,
                minSpendVnd: 0,
            })
        })
    })

    describe("loyaltyCampaignOf", () => {
        it("maps the campaign and every delivery count into its workbench view", () => {
            expect(loyaltyCampaignOf(rowOf())).toEqual({
                id: "campaign-1",
                name: "Autumn",
                segment: { tiers: ["silver"], inactiveDays: 30, birthdayThisMonth: true, minSpendVnd: 500_000 },
                messageDraft: "Hello {ten_khach}",
                draft: "Hello {ten_khach}",
                status: "draft",
                workItemId: "decision-1",
                recipients: 10,
                sent: 3,
                queued: 4,
                failed: 2,
                skipped: 1,
                draftMs: 450,
                createdBy: "Owner",
                createdAt: "2026-10-12T00:00:00.000Z",
                finishedAt: null,
                errorCode: null,
            })
        })

        it("preserves stored instant strings and marks failed campaigns with their stable error code", () => {
            const view = loyaltyCampaignOf(
                rowOf({
                    status: "failed",
                    created_at: "2026-10-12T00:00:00.000Z",
                    finished_at: "2026-10-12T00:01:00.000Z",
                }),
            )

            expect(view.createdAt).toBe("2026-10-12T00:00:00.000Z")
            expect(view.finishedAt).toBe("2026-10-12T00:01:00.000Z")
            expect(view.status).toBe("failed")
            expect(view.errorCode).toBe("LOYALTY_CAMPAIGNS_FAILED")
        })

        it("serializes a terminal Date to its ISO instant", () => {
            expect(loyaltyCampaignOf(rowOf({ finished_at: new Date("2026-10-12T00:01:00.000Z") })).finishedAt).toBe(
                "2026-10-12T00:01:00.000Z",
            )
        })
    })
})
