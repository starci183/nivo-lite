import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentWeeklyReportsService } from "./content-weekly-reports.service"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { expressionValues } from "@tests/fixtures/builders/sql-expression.builder"

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

const registerReading = () => {
    it("reads a stored week, or null when nothing was stored", async () => {
        const em = mockEntityManager()
        const [found] = queueQueryBuilders(em, [
            {
                getRawMany: [
                    {
                        posts: [POST],
                        postCount: 8,
                        suggestion: SUGGESTION,
                        computedAt: "2026-10-19T03:00:00+00:00",
                        postedAt: null,
                    },
                ],
            },
            { getRawMany: [] },
        ])
        const service = await build(em)

        await expect(service.find("ws-1", "2026-10-12")).resolves.toEqual({
            posts: [POST],
            postCount: 8,
            suggestion: SUGGESTION,
            computedAt: "2026-10-19T03:00:00+00:00",
            postedAt: null,
        })
        await expect(service.find("ws-1", "2026-10-05")).resolves.toBeNull()
        expect(found?.callsOf("where")).toEqual([
            [
                "r.workspaceId = :workspaceId AND r.weekStart = :weekStart",
                { workspaceId: "ws-1", weekStart: "2026-10-12" },
            ],
        ])
        expect(found?.callsOf("addSelect")).toEqual([
            ["r.post_count", "postCount"],
            ["r.suggestion", "suggestion"],
            ["to_json(r.computed_at) #>> '{}'", "computedAt"],
            ["to_json(r.posted_at) #>> '{}'", "postedAt"],
        ])
    })
}

const registerStoring = () => {
    it("stores the extras of a week with or without a suggestion", async () => {
        const em = mockEntityManager()
        const [first, second] = queueQueryBuilders(em, [{ execute: { raw: [] } }, { execute: { raw: [] } }])
        const service = await build(em)

        await service.store("ws-1", "2026-10-12", { posts: [POST], postCount: 8, suggestion: SUGGESTION }, "x")
        await service.store("ws-1", "2026-10-12", { posts: [], postCount: 0, suggestion: null }, "y")

        expect(expressionValues(first?.callsOf("values")[0]?.[0])).toEqual({
            workspaceId: "ws-1",
            weekStart: "2026-10-12",
            posts: ":posts::jsonb",
            postCount: 8,
            suggestion: ":suggestion::jsonb",
            computedAt: ":computedAt::timestamptz",
        })
        expect(first?.callsOf("setParameter")).toEqual([
            ["posts", JSON.stringify([POST])],
            ["suggestion", JSON.stringify(SUGGESTION)],
            ["computedAt", "x"],
        ])
        expect(second?.callsOf("setParameter")).toEqual([
            ["posts", "[]"],
            ["suggestion", null],
            ["computedAt", "y"],
        ])
        expect(first?.callsOf("orUpdate")).toEqual([
            [
                ["posts", "post_count", "suggestion", "computed_at"],
                ["workspace_id", "week_start"],
            ],
        ])
    })
}

const registerClaim = () => {
    it("claims the posting of a week once", async () => {
        const em = mockEntityManager()
        const [claim] = queueQueryBuilders(em, [
            { execute: { raw: [{ weekStart: "2026-10-12" }] } },
            { execute: { raw: [] } },
        ])
        const service = await build(em)

        await expect(service.claimPost("ws-1", "2026-10-12", "z")).resolves.toBe(true)
        await expect(service.claimPost("ws-1", "2026-10-12", "z")).resolves.toBe(false)
        expect(expressionValues(claim?.callsOf("values")[0]?.[0])).toEqual({
            workspaceId: "ws-1",
            weekStart: "2026-10-12",
            postedAt: ":postedAt::timestamptz",
        })
        expect(claim?.callsOf("setParameter")).toEqual([["postedAt", "z"]])
    })
}

describe("ContentWeeklyReportsService", () => {
    registerReading()
    registerStoring()
    registerClaim()
})
