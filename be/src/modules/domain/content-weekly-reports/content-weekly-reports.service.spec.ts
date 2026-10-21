import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentWeeklyReportsService } from "./content-weekly-reports.service"
import { CLAIM_WEEKLY_POST, FIND_WEEKLY_REPORT, UPSERT_WEEKLY_EXTRAS } from "./persistence/content-weekly-reports.sql"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ContentWeeklyReportsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(ContentWeeklyReportsService)
}

const POST = {
    id: "PAGE_1",
    channel: "facebook",
    title: "Relax",
    publishedAt: "2026-10-18T02:00:00.000Z",
    engagements: 356,
    href: null,
}
const SUGGESTION = { title: "t", body: "b", sources: [] }

describe("ContentWeeklyReportsService", () => {
    it("reads a stored week, or null when nothing was stored", async () => {
        const em = mockEntityManager({
            query: [
                [
                    FIND_WEEKLY_REPORT,
                    [
                        {
                            posts: [POST],
                            post_count: 8,
                            suggestion: SUGGESTION,
                            computed_at: "2026-10-19T03:00:00.000Z",
                            posted_at: null,
                        },
                    ],
                ],
                [FIND_WEEKLY_REPORT, []],
            ],
        })
        const service = await build(em)

        await expect(service.find("ws-1", "2026-10-12")).resolves.toEqual({
            posts: [POST],
            postCount: 8,
            suggestion: SUGGESTION,
            computedAt: "2026-10-19T03:00:00.000Z",
            postedAt: null,
        })
        await expect(service.find("ws-1", "2026-10-05")).resolves.toBeNull()
        expect(em.query).toHaveBeenCalledWith(FIND_WEEKLY_REPORT, ["ws-1", "2026-10-12"])
    })

    it("stores the extras of a week with or without a suggestion", async () => {
        const em = mockEntityManager({ query: [UPSERT_WEEKLY_EXTRAS, []] })
        const service = await build(em)

        await service.store("ws-1", "2026-10-12", { posts: [POST], postCount: 8, suggestion: SUGGESTION }, "x")
        await service.store("ws-1", "2026-10-12", { posts: [], postCount: 0, suggestion: null }, "y")

        expect(em.query).toHaveBeenNthCalledWith(1, UPSERT_WEEKLY_EXTRAS, [
            "ws-1",
            "2026-10-12",
            JSON.stringify([POST]),
            8,
            JSON.stringify(SUGGESTION),
            "x",
        ])
        expect(em.query).toHaveBeenNthCalledWith(2, UPSERT_WEEKLY_EXTRAS, ["ws-1", "2026-10-12", "[]", 0, null, "y"])
    })

    it("claims the posting of a week once", async () => {
        const em = mockEntityManager({
            query: [
                [CLAIM_WEEKLY_POST, [{ week_start: "2026-10-12" }]],
                [CLAIM_WEEKLY_POST, []],
            ],
        })
        const service = await build(em)

        await expect(service.claimPost("ws-1", "2026-10-12", "z")).resolves.toBe(true)
        await expect(service.claimPost("ws-1", "2026-10-12", "z")).resolves.toBe(false)
        expect(em.query).toHaveBeenCalledWith(CLAIM_WEEKLY_POST, ["ws-1", "2026-10-12", "z"])
    })
})
